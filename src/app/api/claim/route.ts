import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    sendTransaction, // 👈 改用 sendTransaction
    ComputeBudgetProgram 
} from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    
    // 1. 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 查余额
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('locked_reward')
      .eq('wallet', wallet)
      .single();

    if (dbError || !user) throw new Error("User not found");
    const amountToClaim = user.locked_reward; 

    if (amountToClaim < 0.000001) {
      return NextResponse.json({ success: true, amount: 0, message: "余额为0" });
    }

    // 3. 准备转账
    const privateKey = process.env.PAYER_PRIVATE_KEY;
    // ⚡️⚡️ 核心修改：使用 'processed' 极速模式，防止 Cloudflare 超时
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'processed');
    
    const payer = Keypair.fromSecretKey(bs58.decode(privateKey));
    const mint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_MINT!); 
    const recipient = new PublicKey(wallet);

    const payerATA = await getAssociatedTokenAddress(mint, payer.publicKey);
    const recipientATA = await getAssociatedTokenAddress(mint, recipient);

    const decimals = 6; 
    const transferAmount = Math.floor(amountToClaim * Math.pow(10, decimals));

    // 加速费
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    const transaction = new Transaction()
      .add(modifyComputeUnits)
      .add(addPriorityFee)
      .add(createTransferInstruction(payerATA, recipientATA, payer.publicKey, transferAmount));

    transaction.recentBlockhash = (await connection.getLatestBlockhash('processed')).blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);

    console.log(`💸 发送交易 (极速模式)...`);
    
    // ⚡️⚡️ 核心修改：发送后不等待完全确认，直接往下走
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'processed'
    });

    console.log(`✅ 交易已广播: ${signature}`);

    // 4. 立刻清零数据库 (不管链上有没有最终确认，先清零防止重复领)
    // 如果链上失败了，用户可以找管理员补，但绝不能多领。
    await supabase.from('users').update({ 
      locked_reward: 0,
      last_vesting_time: new Date().toISOString()
    }).eq('wallet', wallet);

    // 5. 秒回前端
    return NextResponse.json({ 
      success: true, 
      tx: signature, 
      amount: amountToClaim 
    });

  } catch (err: any) {
    console.error("❌ API Error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
