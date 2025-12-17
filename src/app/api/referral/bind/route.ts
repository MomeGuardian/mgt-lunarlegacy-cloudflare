import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export const runtime = 'edge';

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

    // --- 🕵️‍♂️ 安检 3: 验证签名 (保留这个核心安全逻辑！) ---
    try {
      const signatureUint8 = bs58.decode(signature);
      const walletUint8 = bs58.decode(wallet);
      const messageUint8 = new TextEncoder().encode(message);
      
      const isValid = nacl.sign.detached.verify(messageUint8, signatureUint8, walletUint8);
      
      if (!isValid) {
        return NextResponse.json({ error: '签名验证失败' }, { status: 401 });
      }
    } catch (e) {
      return NextResponse.json({ error: '签名格式错误' }, { status: 400 });
    }

    // --- 💾 数据库操作 (这是唯一需要修改的地方) ---
    // 我们不再在前端手动查重，而是把任务交给刚才写的 SQL 函数
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // 必须用 Service Role Key
    );

    // 🔥 调用智能函数 (防互刷 + 自动计数 + 查重)
    const { data, error } = await supabase.rpc('bind_referrer', {
      user_wallet: wallet,
      referrer_wallet: referrer
    });

    if (error) {
      console.error("RPC Error:", error);
      return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
    }

    // 检查 SQL 函数的返回结果
    // 格式: { success: false, message: "..." }
    if (!data.success) {
        return NextResponse.json({ error: data.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: '绑定成功' });

  } catch (err: any) {
    console.error('Bind API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
