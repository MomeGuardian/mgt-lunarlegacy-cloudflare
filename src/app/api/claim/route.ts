import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🌏 辅助：获取北京时间 00:00 的时间戳
function getBeijingMidnight(date: Date) {
  const utc = date.getTime();
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000);
  beijingTime.setUTCHours(0, 0, 0, 0); // 设为当天 0 点
  return beijingTime.getTime();
}

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    if (!wallet) return NextResponse.json({ error: 'Wallet required' }, { status: 400 });

    // 1. 查数据
    const { data: user } = await supabase
      .from('users')
      .select('locked_reward, last_vesting_time, total_claimed')
      .eq('wallet', wallet)
      .single();

    if (!user || user.locked_reward <= 0) {
        return NextResponse.json({ error: '暂无冻结奖励' }, { status: 400 });
    }

    // 2. 🗓️ 计算累计天数 (核心逻辑)
    const now = new Date();
    // 如果没有上次时间，默认为很久以前 (允许领取)
    const lastTime = user.last_vesting_time ? new Date(user.last_vesting_time) : new Date(0);

    // 获取“今天0点”和“上次0点”的时间戳
    const todayMidnight = getBeijingMidnight(now);
    const lastMidnight = getBeijingMidnight(lastTime);

    // 算出相差几天 (毫秒差 / 一天的毫秒数)
    const diffMs = todayMidnight - lastMidnight;
    const daysPassed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // 如果天数 < 1，说明今天已经领过了
    if (daysPassed < 1) {
         return NextResponse.json({ error: '今日已领，请明日再来累积' }, { status: 400 });
    }

    // 3. 💰 计算释放金额 (引入扫尾 + 累积)
    const CLEAR_THRESHOLD = 10; 
    let releaseAmount = 0;

    if (user.locked_reward <= CLEAR_THRESHOLD) {
        // A. 余额很少 -> 直接清零
        releaseAmount = user.locked_reward;
    } else {
        // B. 余额很多 -> (1/14) * 累计天数
        const dailyBase = user.locked_reward / 14;
        releaseAmount = dailyBase * daysPassed;
    }

    // 🛡️ 安全兜底：如果算出来比余额还多 (比如攒了20天)，最多只能领完剩下的
    if (releaseAmount > user.locked_reward) {
        releaseAmount = user.locked_reward;
    }
    
    // 精度修正
    releaseAmount = Math.floor(releaseAmount * 10000) / 10000;

    if (releaseAmount < 0.1) {
        return NextResponse.json({ error: '累积金额不足 0.1 MGT，请多攒几天' }, { status: 400 });
    }

    // 4. 更新数据库
    const { error } = await supabase.from('users').update({
        locked_reward: user.locked_reward - releaseAmount,
        total_claimed: (user.total_claimed || 0) + releaseAmount,
        last_vesting_time: now.toISOString() // 更新为当前时间
    }).eq('wallet', wallet);

    if (error) throw error;

    // 5. 记录流水
    await supabase.from('withdrawals').insert({
        wallet: wallet,
        amount: releaseAmount,
        status: 'pending',
        tx_hash: `accumulated_${daysPassed}_days` // 标记累积了几天
    });

    return NextResponse.json({ 
        success: true, 
        message: `成功提取 ${daysPassed} 天的收益！(${releaseAmount} MGT)`,
        released: releaseAmount
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
