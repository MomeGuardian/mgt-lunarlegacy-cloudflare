import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 你的代币合约 (MGT)
const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";

// 🔧 配置：如果 API 查不到价格，就用这个默认价格 (用于测试或预售阶段)
const DEFAULT_TEST_PRICE = 0.00011968; // 👈 你可以改成你的预售价格，比如 0.02

// 💰 升级版：使用 DexScreener 获取价格 (新币神器，实时且精准)
async function getMgtPrice() {
  try {
    // 1. 优先请求 DexScreener API
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`);
    const data = await res.json();
    
    // DexScreener 会返回该代币的所有交易对，通常第一个就是流动性最好的
    const pair = data.pairs?.[0]; 
    
    if (pair && pair.priceUsd) {
      console.log(`✅ DexScreener 抓取价格: $${pair.priceUsd}`);
      return parseFloat(pair.priceUsd);
    }

    // 2. (备用) 如果 DexScreener 还没收录，再尝试 Jupiter
    const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${MGT_MINT}`);
    const jupData = await jupRes.json();
    const jupPrice = jupData.data?.[MGT_MINT]?.price;

    if (jupPrice) {
      console.log(`✅ Jupiter 备用价格: $${jupPrice}`);
      return parseFloat(jupPrice);
    }

    // 3. (最后防线) 实在查不到，再用那个预售保底价
    // 只要你的池子建好了，基本上代码不会走到这一步
    console.warn("⚠️ 所有 API 均未返回价格，使用预售保底价");
    return 0.00011988; 

  } catch (error) {
    console.error("价格 API 请求失败:", error);
    return 0.00011988;
  }
}

    // 4. 获取计算用的价格
    const calcPrice = await getMgtPrice();

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
      
      // 💵 计算 USDT 价值 (业绩)
      const usdValue = buyAmount * calcPrice;
      
      console.log(`🚀 监测到买入: ${buyer} +${buyAmount} MGT (计算价格: $${calcPrice}, 总值: $${usdValue.toFixed(2)})`);

      // 5. 查找上级
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        const referrer = user.referrer;
        const reward = buyAmount * 0.05; // 5% 返现 (币)

        console.log(`✅ 归属上级: ${referrer}, 增加业绩: $${usdValue.toFixed(2)}`);

        // A. 记录流水
        await supabase.from('transactions').insert({
            signature,
            buyer,
            referrer,
            token_amount: buyAmount,
            reward_amount: reward,
            usdt_value: usdValue
        });

        // B. 更新上级数据 (待领 + 总赚)
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

            // C. 🔥 使用 RPC 更新团队业绩 (防冲突)
            // 确保你之前在 SQL Editor 运行过 create function increment_team_volume...
            const { error: rpcError } = await supabase.rpc('increment_team_volume', {
                wallet_address: referrer,
                amount_to_add: usdValue
            });

            if (rpcError) {
                console.error("❌ RPC 更新业绩失败:", rpcError);
            } else {
                console.log("✅ 团队业绩更新成功");
            }
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
