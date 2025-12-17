import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

// 1. 价格查询 (防超时)
async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return parseFloat(data.pairs?.[0]?.priceUsd || FALLBACK_PRICE);
  } catch (error) {
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();
    const updates = [];

    for (const tx of body) {
      if (tx.transactionError) continue;
      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];

      // 1. 过滤出 MGT 的所有变动
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);
      if (mgtTransfers.length === 0) continue;

      // 2. 统计每个钱包的【净变动量】 (Net Change)
      // 一个交易里可能既有进又有出，要算总账
      const balanceChanges: Record<string, number> = {};

      for (const t of mgtTransfers) {
          const amount = parseFloat(t.tokenAmount);
          
          // 入账 (Buy/Receive)
          if (t.toUserAccount) {
              balanceChanges[t.toUserAccount] = (balanceChanges[t.toUserAccount] || 0) + amount;
          }
          // 出账 (Sell/Send)
          if (t.fromUserAccount) {
              balanceChanges[t.fromUserAccount] = (balanceChanges[t.fromUserAccount] || 0) - amount;
          }
      }

      // 3. 遍历变动，处理水位线逻辑
      for (const [wallet, changeAmount] of Object.entries(balanceChanges)) {
          // 忽略微小变动
          if (Math.abs(changeAmount * currentPrice) < 0.01) continue;

          updates.push(async () => {
              // 查用户数据 (含水位线)
              const { data: user } = await supabase
                  .from('users')
                  .select('referrer, net_mgt_holding, max_mgt_holding')
                  .eq('wallet', wallet)
                  .single();

              // 如果不是用户，直接跳过 (比如是路由合约)
              if (!user) return;

              const currentNet = user.net_mgt_holding || 0;
              const currentMax = user.max_mgt_holding || 0;
              
              // 计算新的持仓量
              const newNet = currentNet + changeAmount;
              
              // 准备更新数据库的数据
              let updateData: any = { net_mgt_holding: newNet };
              let rewardableAmount = 0;

              // 🟢 情况 A: 净买入，且突破历史新高 (发奖!)
              if (changeAmount > 0 && newNet > currentMax) {
                  // 只奖励【超过历史最高】的那部分
                  // 比如: 历史高点1000，跌到0，买了1200。奖励 = 1200 - 1000 = 200 (不是1200!)
                  // 如果: 历史高点1000，当前1000，买了500。奖励 = 1500 - 1000 = 500。
                  
                  // 公式：本次有效奖励量 = 新持仓 - max(旧持仓, 旧历史高点)
                  // 简化理解：我们只把 max_mgt_holding 推高。推高了多少，就奖励多少。
                  const amountPushingCeiling = newNet - currentMax;
                  
                  rewardableAmount = amountPushingCeiling;
                  
                  // 更新历史最高水位
                  updateData.max_mgt_holding = newNet;

                  console.log(`📈 水位突破: ${wallet} 新高 ${newNet} (原 ${currentMax}), 有效增量 ${rewardableAmount}`);
              } 
              // 🔴 情况 B: 卖出，或者买入但没破新高 (只记账，不发奖)
              else {
                  console.log(`📉 水位波动: ${wallet} 变动 ${changeAmount}, 当前 ${newNet}, 未破高点 ${currentMax}`);
              }

              // 执行数据库更新 (记录最新的持仓和水位)
              await supabase.from('users').update(updateData).eq('wallet', wallet);

              // 🔥 发放奖励 (只有当 rewardableAmount > 0 时)
              if (rewardableAmount > 0 && user.referrer) {
                  const usdValue = rewardableAmount * currentPrice;
                  const reward = rewardableAmount * 0.05; // 5%

                  // 再次检查金额门槛
                  if (usdValue >= 0.1) {
                      console.log(`💰 触发防刷奖励: 给 ${user.referrer} 发 ${reward} MGT (基于净增量 ${rewardableAmount})`);

                      // 记录流水 (标记为 Anti-Wash)
                      await supabase.from('transactions').insert({
                          signature,
                          buyer: wallet,
                          referrer: user.referrer,
                          token_amount: rewardableAmount, // 记的是有效增量
                          reward_amount: reward,
                          usdt_value: usdValue,
                          status: 'processed_anti_wash'
                      });

                      // 加钱
                      await supabase.rpc('increment_team_volume', { wallet_address: user.referrer, amount_to_add: usdValue });
                      await supabase.rpc('increment_pending_reward', { wallet_address: user.referrer, reward_to_add: reward });
                  }
              }
          });
      }
    }

    await Promise.allSettled(updates.map(fn => fn()));
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ success: true, error: err.message });
  }
}
