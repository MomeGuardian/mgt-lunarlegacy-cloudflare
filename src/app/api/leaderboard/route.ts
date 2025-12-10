import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 强制动态模式，防止 Vercel 缓存旧数据
export const dynamic = 'force-dynamic';

export async function GET() {
try {
    // 1. 获取 Supabase URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    // 2. 智能获取 Key (优先用特权 Key，没有就用普通 Key)
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 检查配置是否存在
    if (!supabaseUrl || !supabaseKey) {
    console.error("❌ 环境变量缺失: 请检查 .env.local 文件");
      // 返回空数组而不是报错文本，防止前端 JSON 解析失败
    return NextResponse.json([]);
    }

    // 3. 初始化客户端
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 4. 查询数据 (按邀请人数倒序排列)
    // 尝试查询 'users' 表，如果你的表名不一样请修改这里
    const { data, error } = await supabase
        .from('users') 
        .select('wallet, referrals_count, pending_reward, team_volume')
        .order('referrals_count', { ascending: false })
      .limit(50); // 只取前 50 名

    if (error) {
        console.error('Supabase 查询出错:', error);
      // 如果出错（比如表不存在），返回空数组，防止前端崩盘
        return NextResponse.json([]);
    }

    // 5. 格式化数据返回给前端
    const leaderboardData = data?.map(user => ({
        wallet: user.wallet || 'Unknown',
        referrals: user.referrals_count || 0,
        reward: user.pending_reward || 0,
        team_volume: user.team_volume || 0
    })) || [];

    return NextResponse.json(leaderboardData);

} catch (err) {
    console.error('Leaderboard API 严重错误:', err);
    // 捕获所有未知错误，返回空数组，保证页面不报错
    return NextResponse.json([]); 
}
}