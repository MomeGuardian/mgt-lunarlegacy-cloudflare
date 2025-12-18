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

    // ⚡️ 快速读取数据，避免这里耗时
    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();

    // =========================================================
    // 🧠 步骤 1: 内存聚合 (Memory Aggregation)
    // 先把这批交易里所有的变动，在内存里算好，而不是一笔笔去查库
    // =========================================================
    
    // 记录每个钱包的总净变动量 { "钱包A": +500, "钱包B": -200 }
    const walletNetChanges: Record<string, number> = {};
    // 记录每个钱包对应的最新一笔交易签名 (用于记录流水)
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
    // 🚀 步骤 2: 并发处理 (Parallel Execution)
    // 因为我们已经把同一个钱包的变动合并了，所以现在的并发是安全的！
    // (不同钱包之间互不影响，可以同时跑)
    // =========================================================
    
    const processingPromises = Object.entries(walletNetChanges).map(async ([wallet, netAmount]) => {
        // 过滤微小变动
        if (Math.abs(netAmount * currentPrice) < 0.01) return;

        try {
            // 2.1 查户口 (并发查，速度快)
            const { data: user } = await supabase
                .from('users')
                .select('referrer, net_mgt_holding, max_mgt_holding')
                .eq('wallet', wallet)
                .single();

            if (!user) return; 

            const currentNet = user.net_mgt_holding || 0;
            const currentMax = user.max_mgt_holding || 0;
            const newNet = currentNet + netAmount;
            const signature = walletLastSignature[wallet]; // 取该用户在这批次里的最新签名

            let updateData: any = { net_mgt_holding: newNet };
            let rewardableAmount = 0;

            // 🟢 判断水位线
            if (netAmount > 0 && newNet > currentMax) {
                const amountPushingCeiling = newNet - currentMax;
                rewardableAmount = amountPushingCeiling;
                updateData.max_mgt_holding = newNet; 
                console.log(`📈 [${wallet.slice(0,4)}] 水位突破! 新高:${newNet} (+${rewardableAmount.toFixed(2)})`);
            } else {
                console.log(`📉 [${wallet.slice(0,4)}] 变动:${netAmount}, 未破新高 (Max:${currentMax})`);
            }

            // 2.2 更新数据库 (记录水位)
            const { error: updateError } = await supabase.from('users').update(updateData).eq('wallet', wallet);
            if (updateError) throw updateError;

            // 2.3 发奖
            if (rewardableAmount > 0 && user.referrer) {
                const usdValue = rewardableAmount * currentPrice;
                const reward = rewardableAmount * 0.05;

                if (usdValue >= 0.1) {
                    // 查重流水：防止同一笔签名重复记录 (虽然我们做了内存聚合，但加上这个更保险)
                    const { error: insertError } = await supabase.from('transactions').insert({
                        signature,
                        buyer: wallet,
                        referrer: user.referrer,
                        token_amount: rewardableAmount, // 这一批次的有效总增量
                        reward_amount: reward,
                        usdt_value: usdValue,
                        status: 'processed_anti_wash_batch'
                    });

                    if (!insertError) {
                        // 并发加钱
                        await Promise.all([
                            supabase.rpc('increment_team_volume', { wallet_address: user.referrer, amount_to_add: usdValue }),
                            supabase.rpc('increment_pending_reward', { wallet_address: user.referrer, reward_to_add: reward })
                        ]);
                        console.log(`💰 [BATCH] 发奖给 ${user.referrer.slice(0,4)}: +${reward.toFixed(4)}`);
                    }
                }
            }
        } catch (innerErr) {
            console.error(`处理钱包 ${wallet} 出错:`, innerErr);
        }
    });

    // 等待所有钱包处理完毕
    await Promise.allSettled(processingPromises);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Main Error:', err);
    // 即使超时或出错，也尽量返回 200，避免 Helius 疯狂重试
    return NextResponse.json({ success: true, error: err.message });
  }
}
