import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

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

    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();
    const walletNetChanges: Record<string, number> = {};
    const walletLastSignature: Record<string, string> = {};

for (const tx of body) {
      if (tx.transactionError) continue;
      const signature = tx.signature;
      const { error: insertError } = await supabase
        .from('processed_txs')
        .insert({ signature: signature });

      if (insertError) {
        console.log(`⚠️ 交易 ${signature} 已处理过，跳过 (防止双重统计)`);
        continue;
      }

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

    const processingPromises = Object.entries(walletNetChanges).map(async ([wallet, netAmount]) => {
        if (Math.abs(netAmount * currentPrice) < 0.01) return;
        try {
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
            const updateData = { 
                net_mgt_holding: newNet,
                max_mgt_holding: newNet > currentMax ? newNet : currentMax
            };
            const { error: updateError } = await supabase.from('users').update(updateData).eq('wallet', wallet);
            if (updateError) throw updateError;
            if (netAmount > 0) {
                if (newNet > currentMax) {
                    const amountPushingCeiling = newNet - currentMax;
                    const reward = amountPushingCeiling * 0.05;
                    const usdValue = amountPushingCeiling * currentPrice;

                    if (user.referrer && usdValue >= 0.1) {
                        await supabase.from('transactions').insert({
                            signature,
                            buyer: wallet,
                            referrer: user.referrer,
                            token_amount: amountPushingCeiling,
                            reward_amount: reward,
                            usdt_value: usdValue,
                            status: 'processed_anti_wash_batch'
                        });

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
            else if (netAmount < 0 && user.referrer) {
                const soldAmount = Math.abs(netAmount);
                const penalty = soldAmount * 0.05;
                console.log(`📉 [卖出惩罚] 用户抛售 ${soldAmount}，扣除上级 ${user.referrer.slice(0,4)} 锁定奖励: ${penalty.toFixed(4)}`);
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

    await Promise.allSettled(processingPromises);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Webhook Main Error:', err);
    return NextResponse.json({ success: true, error: err.message });
  }
}
