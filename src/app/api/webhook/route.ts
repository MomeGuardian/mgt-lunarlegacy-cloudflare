import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// 强制动态模式，防止缓存导致数据不更新
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. 初始化 Supabase
    // 优先使用 Service Role Key (权限更高)，如果没有则用 Anon Key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ 环境变量缺失");
      return NextResponse.json({ error: 'Config Error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. 查询排行榜视图 (我们在 SQL 里创建的那个 view)
    const { data, error } = await supabase
      .from('leaderboard_view')
      .select('*')
      .limit(50); // 只取前50名

    if (error) {
      console.error('Supabase 查询失败:', error);
      // 如果视图不存在，尝试直接查表
      if (error.code === '42P01') { 
        const { data: tableData, error: tableError } = await supabase
            .from('users')
            .select('wallet, referrals_count, pending_reward, team_volume')
            .order('referrals_count', { ascending: false })
            .limit(50);
            
        if (tableError) throw tableError;
        
         // 格式化数据返回
        const formatted = tableData?.map(user => ({
            wallet: user.wallet,
            referrals: user.referrals_count || 0,
            reward: user.pending_reward || 0,
            team_volume: user.team_volume || 0
        }));
        return NextResponse.json(formatted);
      }
      throw error;
    }

    // 3. 返回成功数据
    return NextResponse.json(data);

  } catch (err) {
    console.error('Leaderboard API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}