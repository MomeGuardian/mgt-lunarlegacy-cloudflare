import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00012; 

async function getMgtPrice() {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`);
    const data = await res.json();
    const pair = data.pairs?.[0]; 
    if (pair?.priceUsd) return parseFloat(pair.priceUsd);

    const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${MGT_MINT}`);
    const jupData = await jupRes.json();
    const jupPrice = jupData.data?.[MGT_MINT]?.price;
    if (jupPrice) return parseFloat(jupPrice);

    return FALLBACK_PRICE; 
  } catch (error) {
    console.error("❌ 价格 API 失败:", error);
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  try {
    // 1. 验证
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 解析
    const body = await request.json();
    
    // 🕵️‍♂️ [Debug] 打印收到的原始数据 (在 Cloudflare Logs 里能看到)
    console.log("📩 Helius Webhook 收到的数据:", JSON.stringify(body).slice(0, 500)); 

    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No transactions' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();

    for (const tx of body) {
      if (tx.transactionError) continue;

      const signature = tx.signature;
      
      // ✅ 修正逻辑：先找“谁收到了 MGT”，而不是先定死 feePayer
      const transfers = tx.tokenTransfers || [];
      const mgtTransfer = transfers.find((t: any) => t.mint === MGT_MINT);

      if (!mgtTransfer) {
          console.log(`⚠️ 跳过: 交易 ${signature.slice(0,8)} 中没有 MGT 转账`);
          continue;
      }

      // 🎯 核心修正：收币的人才是真正的 Buyer (不管是谁付的 Gas)
      const buyer = mgtTransfer.toUserAccount; 
      const buyAmount = parseFloat(mgtTransfer.tokenAmount);

      // 查重
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) {
          console.log(`⚠️ 跳过: 交易 ${signature.slice(0,8)} 已处理过`);
          continue;
      }

      const usdValue = buyAmount * currentPrice;
      console.log(`🚀 捕获买入: 用户 ${buyer} 买入 ${buyAmount} MGT (价值 $${usdValue.toFixed(2)})`);

      // 5. 查找上级并分账
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        const referrer = user.referrer;
        // 只有大于 0.1 U 的交易才记录，防止垃圾数据
        if (usdValue < 0.1) {
             console.log(`📉 金额太小忽略: $${usdValue}`);
             continue;
        }

        const reward = buyAmount * 0.05; 
        console.log(`✅ 正在发奖: 上级 ${referrer} 应得 ${reward} MGT`);

        // A. 记录流水
        await supabase.from('transactions').insert({
            signature,
            buyer,
            referrer,
            token_amount: buyAmount,
            reward_amount: reward,
            usdt_value: usdValue
        });

        // B. RPC 安全更新业绩
        const { error: rpcError } = await supabase.rpc('increment_team_volume', {
            wallet_address: referrer,
            amount_to_add: usdValue
        });
        
        // C. 更新待领取奖励 (累加)
        // 这里用 rpc 或者先查后改都可以，为了简单先用 SQL
        // 注意：Supabase 没有原生的 increment 更新，最好是用 rpc，或者像你之前那样先查后改
        // 为了稳妥，这里建议用 increment_pending_reward 函数 (如果你数据库里有的话)
        // 如果没有，就保留你原来的先查后改逻辑 👇
        
        const { data: refData } = await supabase.from('users').select('pending_reward, total_earned, locked_reward').eq('wallet', referrer).single();
        if (refData) {
            await supabase.from('users').update({
                // 同时更新 待领取(pending) 和 锁仓(locked) - 根据你的业务逻辑选一个
                // 既然你之前是 locked_reward，那就加到 locked_reward
                locked_reward: (refData.locked_reward || 0) + reward, 
                total_earned: (refData.total_earned || 0) + reward
            }).eq('wallet', referrer);
        }

        if (rpcError) console.error("❌ 业绩更新失败:", rpcError);

      } else {
        console.log(`🤷‍♂️ 无上级: 用户 ${buyer} 是孤儿，不发奖`);
        // 也可以记录一条无奖励的流水
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
