import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, referrer, signature, message } = body;

    // --- 🕵️‍♂️ 安检 1: 基础参数校验 ---
    if (!wallet || !referrer || !signature || !message) {
      return NextResponse.json({ error: '参数缺失' }, { status: 400 });
    }

    // --- 🕵️‍♂️ 安检 2: 禁止自己绑自己 ---
    if (wallet === referrer) {
      return NextResponse.json({ error: '不能绑定自己为上级' }, { status: 400 });
    }

    // --- 🕵️‍♂️ 安检 3: 验证签名 (核心安全逻辑) ---
    try {
      // 1. 将 Base58 格式的签名和钱包地址转回 Uint8Array
      const signatureUint8 = bs58.decode(signature);
      const walletUint8 = bs58.decode(wallet);
      // 2. 将消息转为 Uint8Array
      const messageUint8 = new TextEncoder().encode(message);
      
      // 3. 使用 NaCl 验证签名
      const isValid = nacl.sign.detached.verify(messageUint8, signatureUint8, walletUint8);
      
      if (!isValid) {
        return NextResponse.json({ error: '签名验证失败，请勿伪造请求' }, { status: 401 });
      }
    } catch (e) {
      return NextResponse.json({ error: '签名格式错误' }, { status: 400 });
    }

    // --- 💾 数据库操作 ---
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. 检查用户是否已经有上级 (防篡改)
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('referrer')
      .eq('wallet', wallet)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 是查无此人，忽略
       throw fetchError;
    }

    // 如果已经有上级，且上级不为空，则拒绝修改
    if (user?.referrer) {
      return NextResponse.json({ error: '您已经绑定过上级了，无法更改' }, { status: 400 });
    }

    // 2. 写入绑定关系
    // 注意：这里我们用 upsert，如果用户不存在（login 漏了）就顺便创建，确保万无一失
    const { error: updateError } = await supabase
      .from('users')
      .upsert({ 
        wallet: wallet, 
        referrer: referrer 
      }, { onConflict: 'wallet' }); // 仅更新 referrer，不影响其他字段

    if (updateError) throw updateError;

    // 3. (可选) 增加上级的直推计数 +1
    // 这一步可以用 SQL Trigger 做，也可以简单在这里先读后写，或者暂不处理(等计算业绩时再聚合)
    // 为了性能，我们暂时只记录关系。人数统计建议在 Leaderboard API 里实时 count。

    return NextResponse.json({ success: true, message: '绑定成功' });

  } catch (err: any) {
    console.error('Bind API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}