import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 你的代币合约 (MGT)
const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";

// 🛡️ 保底价格：当所有 API 都挂了时使用
const FALLBACK_PRICE = 0.00012; 

// 💰 智能获取价格 (DexScreener -> Jupiter -> 保底)
async function getMgtPrice() {
  try {
    // 1. 优先请求 DexScreener API (针对新币最准)
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`);
    const data = await res.json();
    const pair = data.pairs?.[0]; 
    
    if (pair && pair.priceUsd) {
      console.log(`✅ DexScreener 抓取价格: $${pair.priceUsd}`);
      return parseFloat(pair.priceUsd);
    }

    // 2. (备用) 如果 DexScreener 没数据，尝试 Jupiter
    const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${MGT_MINT}`);
    const jupData = await jupRes.json();
    const jupPrice = jupData.data?.[MGT_MINT]?.price;

    if (jupPrice) {
       console.log(`✅ Jupiter 备用价格: $${jupPrice}`);
       return parseFloat(jupPrice);
    }

    // 3. (最后防线) 实在查不到，使用保底价
    console.warn(`⚠️ API 均未返回，启用保底价格: $${FALLBACK_PRICE}`);
    return FALLBACK_PRICE; 

  } catch (error) {
    console.error("❌ 价格 API 请求全失败，启用保底价格:", error);
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  try {
    // 1. 安全验证
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    if (secret !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 解析数据
    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No transactions' });

    // 3. 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. 获取本次计算用的价格
    const currentPrice = await getMgtPrice();

    for (const tx of body) {
      if (tx.transactionError) continue;

      const signature = tx.signature;
      const buyer = tx.feePayer;

      // 查重
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) continue;

      // 检查是否买入 MGT
      const transfers = tx.tokenTransfers || [];
      const mgtReceived = transfers.find((t: any) => t.mint === MGT_MINT && t.toUserAccount === buyer);

      if (!mgtReceived) continue;

      const buyAmount = parseFloat(mgtReceived.tokenAmount); // 买入数量
      
      // 💵 计算 USDT 价值
      const usdValue = buyAmount * currentPrice;
      
      console.log(`🚀 买入监测: ${buyer} +${buyAmount} MGT (价格: $${currentPrice}, 价值: $${usdValue.toFixed(2)})`);

      // 5. 查找上级并分账
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        const referrer = user.referrer;
        const reward = buyAmount * 0.05; // 5% 返现

        console.log(`✅ 业绩归属: ${referrer} +$${usdValue.toFixed(2)}`);

        // A. 记录流水
        await supabase.from('transactions').insert({
            signature,
            buyer,
            referrer,
            token_amount: buyAmount,
            reward_amount: reward,
            usdt_value: usdValue
        });

        // B. 更新上级数据
        const { data: refData } = await supabase
            .from('users')
            .select('pending_reward, total_earned')
            .eq('wallet', referrer)
            .single();
        
        if (refData) {
            const newReward = (refData.pending_reward || 0) + reward;
            const newTotalEarned = (refData.total_earned || 0) + reward;
            
            await supabase.from('users').update({
                pending_reward: newReward,
                total_earned: newTotalEarned
            }).eq('wallet', referrer);

            // C. RPC 安全更新业绩
            const { error: rpcError } = await supabase.rpc('increment_team_volume', {
                wallet_address: referrer,
                amount_to_add: usdValue
            });

            if (rpcError) console.error("❌ RPC Error:", rpcError);
        }
      } else {
        // 无上级
        await supabase.from('transactions').insert({
            signature,
            buyer,
            token_amount: buyAmount,
            reward_amount: 0,
            usdt_value: usdValue
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
