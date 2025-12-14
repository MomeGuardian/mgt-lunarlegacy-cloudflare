import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🌏 辅助函数：获取北京时间的日期字符串 (YYYY-MM-DD)
function getBeijingDateStr(date: Date) {
  const utc = date.getTime();
  const beijingTime = new Date(utc + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
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

    // 2. 🕒 校验时间：使用北京时间 (UTC+8) 判断
    const now = new Date();
    const lastTime = user.last_vesting_time ? new Date(user.last_vesting_time) : new Date(0);

    const todayStr = getBeijingDateStr(now);
    const lastDayStr = getBeijingDateStr(lastTime);

    // 如果北京日期一样，说明今天已经领过了
    if (todayStr === lastDayStr) {
         return NextResponse.json({ error: '今日额度已领，请北京时间 00:00 后再来' }, { status: 400 });
    }

    // -----------------------------------------------------------
    // 3. 💰 计算释放金额 (👇 这里加入了扫尾机制)
    // -----------------------------------------------------------
    
    // 🧹 扫尾阈值：剩下不到 10 个时，一次性发完
    const CLEAR_THRESHOLD = 10; 
    
    let releaseAmount = 0;

    if (user.locked_reward <= CLEAR_THRESHOLD) {
        // A. 余额很少 -> 触发扫尾 (全给)
        releaseAmount = user.locked_reward;
    } else {
        // B. 余额很多 -> 正常释放 (给 1/14)
        releaseAmount = user.locked_reward / 14;
    }
    
    // 精度修正 (保留4位小数，防止数据库报错)
    releaseAmount = Math.floor(releaseAmount * 10000) / 10000;

    // 🛡️ 最后的底线：如果算出来实在太少 (比如 0.0000)，就不发了，省 Gas
    if (releaseAmount < 0.1) {
        return NextResponse.json({ error: '可领金额不足 0.1 MGT，请继续积累' }, { status: 400 });
    }

    // 4. 更新数据库
    const { error } = await supabase.from('users').update({
        locked_reward: user.locked_reward - releaseAmount,
        total_claimed: (user.total_claimed || 0) + releaseAmount,
        last_vesting_time: now.toISOString() // 更新时间
    }).eq('wallet', wallet);

    if (error) throw error;

    // 5. 记录流水
    await supabase.from('withdrawals').insert({
        wallet: wallet,
        amount: releaseAmount,
        status: 'pending',
        tx_hash: 'daily_vesting_sweep' // 标记一下
    });

    return NextResponse.json({ 
        success: true, 
        message: `释放成功！(${releaseAmount} MGT)`,
        released: releaseAmount
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
