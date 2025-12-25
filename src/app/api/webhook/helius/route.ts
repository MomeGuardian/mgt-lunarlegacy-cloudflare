import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); 
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

    const validTxsRaw = body.filter((tx: any) => !tx.transactionError);
    if (validTxsRaw.length === 0) return NextResponse.json({ message: 'No valid tx' });

    const signatures = validTxsRaw.map((tx: any) => tx.signature);
    const { data: existingRows } = await supabase
        .from('processed_txs')
        .select('signature')
        .in('signature', signatures);
    
    const existingSet = new Set(existingRows?.map((row: any) => row.signature) || []);
    const newSignatures = signatures.filter((s: string) => !existingSet.has(s));

    if (newSignatures.length === 0) {
        console.log("⚠️ 所有交易已处理，跳过。");
        return NextResponse.json({ message: 'Skipped' });
    }

    await supabase.from('processed_txs').insert(
        newSignatures.map((s: string) => ({ signature: s }))
    ).select().maybeSingle().catch(() => {});

    const currentPrice = await getMgtPrice();
    const walletNetChanges: Record<string, number> = {};
    const walletLastSignature: Record<string, string> = {};

    for (const tx of validTxsRaw) {
      if (existingSet.has(tx.signature)) continue;
      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);
      
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

    const wallets = Object.entries(walletNetChanges);
    console.log(`处理队列: ${wallets.length} 个钱包`);

    for (const [wallet, netAmount] of wallets) {
        if (Math.abs(netAmount * currentPrice) < 0.01) continue;
        try {
            const { data: user } = await supabase
                .from('users')
                .select('referrer, net_mgt_holding, max_mgt_holding')
                .eq('wallet', wallet)
                .single();

            if (!user) continue; 
            const currentNet = user.net_mgt_holding || 0;
            const currentMax = user.max_mgt_holding || 0;
            const newNet = currentNet + netAmount;
            const signature = walletLastSignature[wallet]; 
            const updateData = { 
                net_mgt_holding: newNet,
                max_mgt_holding: newNet > currentMax ? newNet : currentMax
            };
            const { error: updateError } = await supabase.from('users').update(updateData).eq('wallet', wallet);
            if (updateError) {
                console.error(`更新用户 ${wallet.slice(0,4)} 失败:`, updateError);
                continue;
            }

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
                            status: 'processed'
                        });

                        await supabase.rpc('increment_team_volume', { wallet_address: user.referrer, amount_to_add: usdValue });
                        await supabase.rpc('increment_pending_reward', { wallet_address: user.referrer, reward_to_add: reward });
                        
                        console.log(`📈 [奖励成功] ${user.referrer.slice(0,4)} +${reward.toFixed(2)}`);
                    }
                } else {
                    console.log(`📉 [填坑] ${wallet.slice(0,4)} 未破新高`);
                }
            } 
            else if (netAmount < 0 && user.referrer) {
                const soldAmount = Math.abs(netAmount);
                const penalty = soldAmount * 0.05;
                console.log(`📉 [惩罚] ${user.referrer.slice(0,4)} -${penalty.toFixed(2)}`);
                
                await supabase.rpc('decrement_locked_reward', {
                    wallet_address: user.referrer,
                    amount_to_remove: penalty
                });
            }

        } catch (innerErr) {
            console.error(`处理钱包 ${wallet} 出错:`, innerErr);
        }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ success: true, error: err.message });
  }
}
