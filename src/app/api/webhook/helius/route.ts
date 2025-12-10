import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 你的代币合约 (MGT)
const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";

export async function POST(request: Request) {
  try {
    // 1. 安全验证 (防止黑客伪造 Webhook)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    // ⚠️ 必须在 Vercel 环境变量里设置 HELIUS_WEBHOOK_SECRET
    if (secret !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 解析 Helius 发来的交易数据
    const body = await request.json();
    if (!body || !Array.isArray(body)) {
      return NextResponse.json({ message: 'No transactions' });
    }

    // 3. 初始化 Supabase (使用 Service Role Key，因为要写数据库)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. 遍历处理每一笔交易
    for (const tx of body) {
      // 排除失败交易
      if (tx.transactionError) continue;

      // 🔍 我们只关心 "SWAP" 类型的交易
      if (tx.type !== 'SWAP') continue;

      const signature = tx.signature;
      const buyer = tx.feePayer; // 付油费的人通常是买家

      // 查重：防止同一笔交易处理两次
      const { data: exist } = await supabase.from('transactions').select('signature').eq('signature', signature).single();
      if (exist) continue;

      // 🔍 核心逻辑：判断是否买入了 MGT
      // 检查 tokenTransfers 数组，看买家是否收到了 MGT
      const transfers = tx.tokenTransfers || [];
      const mgtReceived = transfers.find((t: any) => 
        t.mint === MGT_MINT && t.toUserAccount === buyer
      );

      // 如果没收到 MGT，说明不是买入，跳过
      if (!mgtReceived) continue;

      const buyAmount = parseFloat(mgtReceived.tokenAmount);
      console.log(`🚀 监测到买入: ${buyer} +${buyAmount} MGT`);

      // 5. 查找这个买家有没有绑定上级
      const { data: user } = await supabase.from('users').select('referrer').eq('wallet', buyer).single();

      if (user?.referrer) {
        // 💰 有上级，开始分钱！
        const referrer = user.referrer;
        const reward = buyAmount * 0.05; // 5% 返现

        console.log(`✅ 发放奖励: 上级 ${referrer} 获得 ${reward}`);

        // A. 记录流水
        await supabase.from('transactions').insert({
            signature,
            buyer,
            referrer,
            token_amount: buyAmount,
            reward_amount: reward
        });

        // B. 更新上级余额 (查-改-存)
        const { data: refData } = await supabase.from('users').select('pending_reward, team_volume').eq('wallet', referrer).single();
        
        if (refData) {
            const newReward = (refData.pending_reward || 0) + reward;
            const newVolume = (refData.team_volume || 0) + buyAmount;
            
            await supabase.from('users').update({
                pending_reward: newReward,
                team_volume: newVolume
            }).eq('wallet', referrer);
        }
      } else {
        // 🤷‍♂️ 无上级，也记录一下流水(方便以后数据分析)
        console.log(`无上级，跳过奖励`);
        await supabase.from('transactions').insert({
            signature,
            buyer,
            token_amount: buyAmount,
            reward_amount: 0
        });
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}