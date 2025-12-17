import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    ComputeBudgetProgram // 👈 新增引入
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
    console.log(`👤 用户: ${wallet}, 余额: ${amountToClaim}`);

    if (amountToClaim < 0.000001) {
      return NextResponse.json({ success: true, amount: 0, message: "余额为0" });
    }

    // 3. 准备转账
    const privateKey = process.env.PAYER_PRIVATE_KEY;
    if (!privateKey) throw new Error("Private key missing");

    // ⚠️ 建议：如果 QuickNode 还是慢，可以尝试换回官方主网地址测试
    // const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'confirmed');
    
    const payer = Keypair.fromSecretKey(bs58.decode(privateKey));
    const mint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_MINT!); 
    const recipient = new PublicKey(wallet);

    const payerATA = await getAssociatedTokenAddress(mint, payer.publicKey);
    const recipientATA = await getAssociatedTokenAddress(mint, recipient);

    const decimals = 6; 
    const transferAmount = Math.floor(amountToClaim * Math.pow(10, decimals));

    // 🔥🔥 核心修改：添加优先费 (加速交易) 🔥🔥
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 200_000 
    });

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
      microLamports: 100_000 // 支付更高的优先费 (约 0.0001 SOL)
    });

    const transaction = new Transaction()
      .add(modifyComputeUnits) // 1. 设置计算上限
      .add(addPriorityFee)     // 2. 加小费
      .add(                    // 3. 转账指令
        createTransferInstruction(
          payerATA,
          recipientATA,
          payer.publicKey,
          transferAmount
        )
      );

    // 发送交易
    console.log(`💸 发送交易 (带优先费)...`);
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log(`✅ 交易成功: ${signature}`);

    // 4. 清零数据库
    await supabase.from('users').update({ 
      locked_reward: 0,
      last_vesting_time: new Date().toISOString()
    }).eq('wallet', wallet);

    return NextResponse.json({ 
      success: true, 
      tx: signature, 
      amount: amountToClaim 
    });

  } catch (err: any) {
    console.error("❌ API Error:", err);
    // 返回具体错误信息给前端，方便调试
    return NextResponse.json({ error: err.message || "Transfer failed" }, { status: 500 });
  }
}
