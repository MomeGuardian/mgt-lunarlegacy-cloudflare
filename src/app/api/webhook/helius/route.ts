import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 你的代币合约 (MGT)
const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";

// 💰 辅助函数：从 Jupiter 获取 MGT 当前价格 (USDC/USDT)
async function getMgtPrice() {
  try {
    const response = await fetch(`https://api.jup.ag/price/v2?ids=${MGT_MINT}`);
    const data = await response.json();
    const price = data.data[MGT_MINT]?.price;
    return price ? parseFloat(price) : 0;
  } catch (error) {
    console.error("获取 MGT 价格失败:", error);
    return 0;
  }
}

// (备用) 辅助函数：获取 SOL 价格
async function getSolPriceInUsd() {
  try {
    const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    const data = await res.json();
    const price = data?.data?.['So11111111111111111111111111111111111111112']?.price;
    return parseFloat(price) || 0;
  } catch (error) {
    console.error("获取 SOL 价格失败:", error);
    return 0;
  }
}

export async function POST(request: Request) {
  try {
    // 1. 安全验证 (检查 Helius Secret)
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

    // 4. 获取当前币价 (一次请求处理一批交易，节省资源)
    // 这里我们用 MGT 的价格来计算 U 本位价值
    const currentPrice = await getMgtPrice();
    console.log(`📊 当前 MGT 价格: $${currentPrice}`);

    for (const tx of body) {
      // 过滤掉失败的交易或非 Swap 类型的交易
      if (tx.transactionError) continue;

      const signature = tx.signature;
      const buyer = tx.feePayer;

      // 🔍 查重：防止同一笔交易被处理两次
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) continue;

      // 🔍 检查是否买入 MGT
      const transfers = tx.tokenTransfers || [];
      const mgtReceived = transfers.find((t: any) => t.mint === MGT_MINT && t.toUserAccount === buyer);

      // 如果不是买入 MGT，跳过
      if (!mgtReceived) continue;

      const buyAmount = parseFloat(mgtReceived.tokenAmount); // 买入的代币数量
      
      // 💵 计算 USDT 价值 (业绩)
      const usdValue = buyAmount * currentPrice;
      
      console.log(`🚀 监测到买入: ${buyer} +${buyAmount} MGT (价值 $${usdValue.toFixed(2)})`);

      // 5. 查找上级并分账
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        const referrer = user.referrer;
        const reward = buyAmount * 0.05; // 5% 返现 (代币数量)

        console.log(`✅ 业绩归属: 上级 ${referrer} 增加业绩 $${usdValue.toFixed(2)}`);

        // A. 记录流水 (包含 USDT 价值)
        await supabase.from('transactions').insert({
            signature,
            buyer,
            referrer,
            token_amount: buyAmount,
            reward_amount: reward,
            usdt_value: usdValue // ✅ 记录这笔交易值多少钱
        });

        // B. 更新上级数据 (待领奖励 + 历史总收益)
        const { data: refData } = await supabase
            .from('users')
            .select('pending_reward, total_earned')
            .eq('wallet', referrer)
            .single();
        
        if (refData) {
            const newReward = (refData.pending_reward || 0) + reward;
            // ✅ 新增：历史总收益也累加
            const newTotalEarned = (refData.total_earned || 0) + reward;
            
            // 更新用户表 (奖励部分)
            await supabase.from('users').update({
                pending_reward: newReward,
                total_earned: newTotalEarned
            }).eq('wallet', referrer);

            // C. 🔥 关键升级：使用 RPC 函数安全更新团队业绩
            // 这一步调用了我们在 SQL Editor 里写的 increment_team_volume 函数
            const { error: rpcError } = await supabase.rpc('increment_team_volume', {
                wallet_address: referrer,
                amount_to_add: usdValue
            });

            if (rpcError) {
                console.error("❌ RPC 更新业绩失败:", rpcError);
            } else {
                console.log("✅ 团队业绩已通过 RPC 更新");
            }
        }
      } else {
        // 无上级记录，仅记录交易
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
