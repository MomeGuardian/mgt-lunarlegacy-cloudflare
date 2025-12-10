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
    console.error("获取价格失败:", error);
    return 0;
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

    // 4. 获取当前币价 (一次请求处理一批交易，节省资源)
    const currentPrice = await getMgtPrice();
    console.log(`📊 当前 MGT 价格: $${currentPrice}`);

    for (const tx of body) {
      if (tx.transactionError || tx.type !== 'SWAP') continue;

      const signature = tx.signature;
      const buyer = tx.feePayer;

      // 查重
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) continue;

      // 检查是否买入 MGT
      const transfers = tx.tokenTransfers || [];
      const mgtReceived = transfers.find((t: any) => t.mint === MGT_MINT && t.toUserAccount === buyer);

      if (!mgtReceived) continue;

      const buyAmount = parseFloat(mgtReceived.tokenAmount); // 买入的代币数量
      
      // 💵 计算 USDT 价值
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

        // B. 更新上级数据
        const { data: refData } = await supabase.from('users').select('pending_reward, team_volume').eq('wallet', referrer).single();
        
        if (refData) {
            const newReward = (refData.pending_reward || 0) + reward;
            // ✅ 核心修改：team_volume 现在累加的是 USDT 价值，而不是代币数量
            const newVolume = (refData.team_volume || 0) + usdValue; 
            
            await supabase.from('users').update({
                pending_reward: newReward,
                team_volume: newVolume
            }).eq('wallet', referrer);
        }
      } else {
        // 无上级记录
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
