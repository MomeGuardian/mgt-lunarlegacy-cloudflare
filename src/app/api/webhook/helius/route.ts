import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

// 1. 价格查询 (缩短超时时间到 1.5s，以此换取更多处理时间)
async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); 
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

    // ⚡️ 快速读取数据
    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();

    // =========================================================
    // 🧠 步骤 1: 内存聚合 (Memory Aggregation)
    // 先把这批交易里所有的变动，在内存里算好
    // =========================================================
    
    // 记录每个钱包的总净变动量
    const walletNetChanges: Record<string, number> = {};
    // 记录每个钱包对应的最新一笔交易签名
    const walletLastSignature: Record<string, string> = {};

    for (const tx of body) {
      if (tx.transactionError) continue;
      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];
      
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);
      if (mgtTransfers.length === 0) continue;

      for (const t of mgtTransfers) {
          const amount = parseFloat(t.tokenAmount);
          if (t.toUserAccount) {
              walletNetChanges[t.toUserAccount] = (walletNetChanges[t.toUserAccount] || 0) + amount;
              walletLastSignature[t.toUserAccount] = signature;
          }
          if (t.fromUserAccount) {
              walletNetChanges[t.fromUserAccount] = (walletNetChanges[t.fromUserAccount] || 0) - amount;
              walletLastSignature[t.fromUserAccount] = signature;
          }
      }
    }

    // =========================================================
    // 🚀 步骤 2: 并发处理 (包含 买入奖励 & 卖出惩罚)
    // =========================================================
    
    const processingPromises = Object.entries(walletNetChanges).map(async ([wallet, netAmount]) => {
        // 过滤微小变动
        if (Math.abs(netAmount * currentPrice) < 0.01) return;

        try {
            // 2.1 查户口
            const { data: user } = await supabase
                .from('users')
                .select('referrer, net_mgt_holding, max_mgt_holding')
                .eq('wallet', wallet)
                .single();

            if (!user) return; 

            const currentNet = user.net_mgt_holding || 0;
            const currentMax = user.max_mgt_holding || 0;
            const newNet = currentNet + netAmount;
            const signature = walletLastSignature[wallet];

            // 🟢 更新水位线
            // 注意：哪怕是卖出，max_mgt_holding 也不降，保持历史最高，防止填坑刷单
            const updateData = { 
                net_mgt_holding: newNet,
                max_mgt_holding: newNet > currentMax ? newNet : currentMax
            };
            
            // 写入数据库更新水位
            const { error: updateError } = await supabase.from('users').update(updateData).eq('wallet', wallet);
            if (updateError) throw updateError;

            // -------------------------------------------------
            // 🔥 分支 A: 净买入 (发奖)
            // -------------------------------------------------
            if (netAmount > 0) {
                if (newNet > currentMax) {
                    const amountPushingCeiling = newNet - currentMax;
                    const reward = amountPushingCeiling * 0.05;
                    const usdValue = amountPushingCeiling * currentPrice;

                    // 只有金额达标且有上级才发奖
                    if (user.referrer && usdValue >= 0.1) {
                         // 记录流水
                         await supabase.from('transactions').insert({
                            signature,
                            buyer: wallet,
                            referrer: user.referrer,
                            token_amount: amountPushingCeiling,
                            reward_amount: reward,
                            usdt_value: usdValue,
                            status: 'processed_anti_wash_batch'
                        });

                        // 加钱
                        await Promise.all([
                            supabase.rpc('increment_team_volume', { wallet_address: user.referrer, amount_to_add: usdValue }),
                            supabase.rpc('increment_pending_reward', { wallet_address: user.referrer, reward_to_add: reward })
                        ]);
                        
                        console.log(`📈 [买入奖励] 给 ${user.referrer.slice(0,4)} 增加 ${reward.toFixed(4)} MGT`);
                    }
                } else {
                    console.log(`📉 [填坑] ${wallet.slice(0,4)} 买入 ${netAmount}，未破新高，无奖励`);
                }
            } 
            
            // -------------------------------------------------
            // 💀 分支 B: 净卖出 (惩罚/回撤奖励)
            // -------------------------------------------------
            else if (netAmount < 0 && user.referrer) {
                // 卖出时，netAmount 是负数 (例如 -1000)
                // 惩罚金额 = 卖出量绝对值 * 5%
                const soldAmount = Math.abs(netAmount);
                const penalty = soldAmount * 0.05;

                console.log(`📉 [卖出惩罚] 用户抛售 ${soldAmount}，扣除上级 ${user.referrer.slice(0,4)} 锁定奖励: ${penalty.toFixed(4)}`);

                // 调用扣钱函数 decrement_locked_reward
                const { error: penaltyError } = await supabase.rpc('decrement_locked_reward', {
                    wallet_address: user.referrer,
                    amount_to_remove: penalty
                });
                
                if (penaltyError) console.error("惩罚扣除失败:", penaltyError);
            }

        } catch (innerErr) {
            console.error(`处理钱包 ${wallet} 出错:`, innerErr);
        }
    });

    // 等待所有处理完毕
    await Promise.allSettled(processingPromises);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Main Error:', err);
    return NextResponse.json({ success: true, error: err.message });
  }
}
