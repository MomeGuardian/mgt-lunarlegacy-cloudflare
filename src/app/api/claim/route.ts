import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

// ⚠️ 必须要有这行，Cloudflare 才能跑
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    
    // 1. 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 查数据库余额
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('locked_reward') // 只查余额，不查时间
      .eq('wallet', wallet)
      .single();

    if (dbError || !user) throw new Error("User not found");

    // 🔥 核心修改：直接读取余额，没有任何除法，没有任何时间限制
    const amountToClaim = user.locked_reward; 

    console.log(`👤 用户: ${wallet}, 余额: ${amountToClaim}`);

    // 如果余额太少，就不发了
    if (amountToClaim < 0.000001) {
      return NextResponse.json({ 
        success: true, 
        amount: 0, 
        message: "余额为0，无需提现" 
      });
    }

    // 3. 准备区块链转账
    const privateKey = process.env.PAYER_PRIVATE_KEY;
    if (!privateKey) throw new Error("Server private key missing");

    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');
    const payer = Keypair.fromSecretKey(bs58.decode(privateKey));
    const mint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_MINT!); 
    const recipient = new PublicKey(wallet);

    // 获取账户地址
    const payerATA = await getAssociatedTokenAddress(mint, payer.publicKey);
    const recipientATA = await getAssociatedTokenAddress(mint, recipient);

    // 计算金额 (假设精度是 6，如果是 9 请改成 1_000_000_000)
    const decimals = 6; 
    const transferAmount = Math.floor(amountToClaim * Math.pow(10, decimals));

    console.log(`💸 开始转账: ${amountToClaim} MGT`);

    const transaction = new Transaction().add(
      createTransferInstruction(
        payerATA,
        recipientATA,
        payer.publicKey,
        transferAmount
      )
    );

    // 发送交易 (这一步会花几秒钟)
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log(`✅ 交易成功: ${signature}`);

    // 4. 清零数据库
    await supabase.from('users').update({ 
      locked_reward: 0,
      last_vesting_time: new Date().toISOString()
    }).eq('wallet', wallet);

    // 5. 返回结果
    return NextResponse.json({ 
      success: true, 
      tx: signature, 
      amount: amountToClaim 
    });

  } catch (err: any) {
    console.error("❌ API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
