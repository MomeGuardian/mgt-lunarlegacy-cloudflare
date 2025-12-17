import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🌏 辅助：获取北京时间 00:00 的时间戳
function getBeijingMidnight(date: Date) {
  const utc = date.getTime();
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000);
  beijingTime.setUTCHours(0, 0, 0, 0); 
  return beijingTime.getTime();
}

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    
    // 🕵️‍♂️ [Debug] 看看后端收到了谁的请求
    console.log(`🔍 收到提现请求，钱包: ${wallet}`);

    if (!wallet) return NextResponse.json({ error: 'Wallet required' }, { status: 400 });

    // 1. 查数据
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('locked_reward, last_vesting_time, total_claimed')
      .eq('wallet', wallet)
      .single();

    // 🕵️‍♂️ [Debug] 看看数据库查到了什么鬼
    if (dbError) {
        console.error("❌ 数据库查询报错:", dbError.message);
    } else {
        console.log("📊 数据库查到的用户数据:", user);
    }

    if (!user) {
        console.error("⚠️ 用户不存在 (User is null)");
        return NextResponse.json({ error: '暂无冻结奖励 (用户未找到)' }, { status: 400 });
    }

    if (user.locked_reward <= 0) {
        console.error(`⚠️ 余额不足，当前余额: ${user.locked_reward}`);
        return NextResponse.json({ error: '暂无冻结奖励 (余额为0)' }, { status: 400 });
    }

    // 2. 🗓️ 计算累计天数
    const now = new Date();
    const lastTime = user.last_vesting_time ? new Date(user.last_vesting_time) : new Date(0);

    const todayMidnight = getBeijingMidnight(now);
    const lastMidnight = getBeijingMidnight(lastTime);

    const diffMs = todayMidnight - lastMidnight;
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    console.log(`⏳ 时间计算: 距上次领取已过 ${daysPassed} 天`);

    if (daysPassed < 1) {
         return NextResponse.json({ error: '今日已领，请明日再来累积' }, { status: 400 });
    }

    // 3. 💰 计算释放金额
    const CLEAR_THRESHOLD = 10; 
    let releaseAmount = 0;

    if (user.locked_reward <= CLEAR_THRESHOLD) {
        releaseAmount = user.locked_reward;
    } else {
        const dailyBase = user.locked_reward / 14;
        releaseAmount = dailyBase * daysPassed;
    }

    if (releaseAmount > user.locked_reward) {
        releaseAmount = user.locked_reward;
    }
    
    releaseAmount = Math.floor(releaseAmount * 10000) / 10000;

    console.log(`💰 准备释放: ${releaseAmount} MGT`);

    if (releaseAmount < 0.1) {
        return NextResponse.json({ error: '累积金额不足 0.1 MGT，请多攒几天' }, { status: 400 });
    }

    // 4. 更新数据库
    const { error } = await supabase.from('users').update({
        locked_reward: user.locked_reward - releaseAmount,
        total_claimed: (user.total_claimed || 0) + releaseAmount,
        last_vesting_time: now.toISOString()
    }).eq('wallet', wallet);

    if (error) throw error;

    // 5. 记录流水
    await supabase.from('withdrawals').insert({
        wallet: wallet,
        amount: releaseAmount,
        status: 'pending',
        tx_hash: `accumulated_${daysPassed}_days`
    });

    return NextResponse.json({ 
        success: true, 
        message: `成功提取 ${daysPassed} 天的收益！(${releaseAmount} MGT)`,
        released: releaseAmount
    });

  } catch (err: any) {
    console.error("💥 系统崩溃:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
