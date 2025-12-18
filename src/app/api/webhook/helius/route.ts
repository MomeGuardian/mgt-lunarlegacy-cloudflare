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

    // ⚡️⚡️ 核心修复：移除 Promise.all，使用串行循环 (Sequential Loop)
    // 必须等待上一笔处理完写入数据库，才能处理下一笔，防止“吞单”
    for (const tx of body) {
      if (tx.transactionError) continue;
      const signature = tx.signature;

      // 1. 查重 (防止 Helius 重复推送)
      const { data: exist } = await supabase.from('transactions').select('id').eq('signature', signature).single();
      if (exist) {
          console.log(`⚠️ 跳过重复交易: ${signature.slice(0,6)}`);
          continue;
      }

      const transfers = tx.tokenTransfers || [];
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);
      if (mgtTransfers.length === 0) continue;

      // 2. 计算净变动 (解决 OKX 翻倍/聚合路由问题)
      const balanceChanges: Record<string, number> = {};
      for (const t of mgtTransfers) {
          const amount = parseFloat(t.tokenAmount);
          if (t.toUserAccount) balanceChanges[t.toUserAccount] = (balanceChanges[t.toUserAccount] || 0) + amount;
          if (t.fromUserAccount) balanceChanges[t.fromUserAccount] = (balanceChanges[t.fromUserAccount] || 0) - amount;
      }

      // 3. 处理每个变动 (必须 await，一个个处理！)
      for (const [wallet, changeAmount] of Object.entries(balanceChanges)) {
          // 忽略微小变动
          if (Math.abs(changeAmount * currentPrice) < 0.01) continue;

          // 3.1 查户口 (同时查水位线字段)
          const { data: user } = await supabase
              .from('users')
              .select('referrer, net_mgt_holding, max_mgt_holding')
              .eq('wallet', wallet)
              .single();

          if (!user) continue; // 不是我们的用户

          const currentNet = user.net_mgt_holding || 0;
          const currentMax = user.max_mgt_holding || 0;
          const newNet = currentNet + changeAmount;
          
          let updateData: any = { net_mgt_holding: newNet };
          let rewardableAmount = 0;

          // 🟢 核心判定：净买入 且 突破历史新高 (防刷单)
          if (changeAmount > 0 && newNet > currentMax) {
              const amountPushingCeiling = newNet - currentMax;
              rewardableAmount = amountPushingCeiling;
              updateData.max_mgt_holding = newNet; // 推高水位线

              console.log(`📈 [${wallet.slice(0,4)}] 水位突破! 原高:${currentMax} -> 新高:${newNet} | 有效增量:${rewardableAmount.toFixed(2)}`);
          } else {
              console.log(`📉 [${wallet.slice(0,4)}] 未触发奖励: 变动:${changeAmount}, 当前持仓:${newNet}, 历史最高:${currentMax} (未破新高)`);
          }

          // 3.2 更新数据库 (这一步必须 await 完了才能处理下一笔！)
          await supabase.from('users').update(updateData).eq('wallet', wallet);

          // 3.3 发奖
          if (rewardableAmount > 0 && user.referrer) {
              const usdValue = rewardableAmount * currentPrice;
              const reward = rewardableAmount * 0.05;

              if (usdValue >= 0.1) {
                  console.log(`💰 发奖给 ${user.referrer.slice(0,4)}: +${reward.toFixed(4)} MGT`);
                  
                  const { error: insertError } = await supabase.from('transactions').insert({
                      signature,
                      buyer: wallet,
                      referrer: user.referrer,
                      token_amount: rewardableAmount,
                      reward_amount: reward,
                      usdt_value: usdValue,
                      status: 'processed_anti_wash'
                  });

                  if (!insertError) {
                      await supabase.rpc('increment_team_volume', { wallet_address: user.referrer, amount_to_add: usdValue });
                      await supabase.rpc('increment_pending_reward', { wallet_address: user.referrer, reward_to_add: reward });
                  }
              }
          }
      }
    }
    
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ success: true, error: err.message });
  }
}
