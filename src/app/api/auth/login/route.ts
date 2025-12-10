import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet } = body;

    // 1. 基础校验
    if (!wallet || wallet.length < 32) {
      return NextResponse.json({ error: '无效的钱包地址' }, { status: 400 });
    }

    // 2. 初始化 Supabase (使用服务端私钥，权限更高)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. 尝试插入用户 (如果存在则忽略，ON CONFLICT DO NOTHING)
    // 这里的 upsert + ignoreDuplicates 相当于 "不存在则创建，存在则什么都不做"
    const { error } = await supabase
      .from('users')
      .upsert({ wallet: wallet }, { onConflict: 'wallet', ignoreDuplicates: true });

    if (error) {
      console.error('用户注册失败:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 4. 返回成功
    return NextResponse.json({ message: 'Login success', wallet });

  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}