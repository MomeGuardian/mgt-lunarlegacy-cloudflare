import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    ComputeBudgetProgram 
} from '@solana/web3.js';
import { 
    getAssociatedTokenAddress, 
    createTransferInstruction, 
    createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import bs58 from 'bs58';

export const runtime = 'edge';

// ⚙️ 配置：硬性锁仓周期 (30天)
// 只有持有满 30 天才能领取，否则一分钱不给
const LOCK_PERIOD_DAYS = 30;

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
      .select('locked_reward, total_claimed, last_vesting_time')
      .eq('wallet', wallet)
      .single();

    if (dbError || !user) throw new Error("User not found");

    // 🔥🔥 核心逻辑优化：30天悬崖式解锁 (Cliff Vesting) 🔥🔥
    const now = Date.now();
    // 获取上次领取时间（如果是新用户，默认为现在）
    const lastTime = user.last_vesting_time ? new Date(user.last_vesting_time).getTime() : now;
    
    const currentLocked = user.locked_reward || 0;
    
    // 如果没有余额，直接返回
    if (currentLocked <= 0.000001) {
       return NextResponse.json({ success: true, amount: 0, message: "暂无待释放资产" });
    }

    // 计算距离上次领取过去了多久
    const msPassed = now - lastTime;
    const daysPassed = msPassed / (1000 * 60 * 60 * 24); // 换算成天

    // 🛑 核心限制：不到 30 天，坚决不给领！
    if (daysPassed < LOCK_PERIOD_DAYS) {
        const daysRemaining = Math.ceil(LOCK_PERIOD_DAYS - daysPassed);
        return NextResponse.json({ 
            success: false, 
            error: `考核期未满！请耐心持有。距离下次释放还需 ${daysRemaining} 天。` 
        }, { status: 400 });
    }

    // ✅ 到了 30 天，一次性全部释放
    let amountToClaim = currentLocked;

    // 🛡️ 最小提现门槛 (防止粉尘攻击)
    if (amountToClaim < 0.1) {
        return NextResponse.json({ 
            success: false, 
            error: `金额太少 (${amountToClaim.toFixed(4)})，暂不可提现` 
        }, { status: 400 });
    }

    console.log(`🔓 考核达标! 锁仓 ${daysPassed.toFixed(1)} 天 > ${LOCK_PERIOD_DAYS} 天 | 释放全额: ${amountToClaim}`);

    // 3. 准备转账 (包含自动开户逻辑)
    const privateKey = process.env.PAYER_PRIVATE_KEY;
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'processed');
    
    const payer = Keypair.fromSecretKey(bs58.decode(privateKey));
    const mint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_MINT!); 
    const recipient = new PublicKey(wallet);

    const payerATA = await getAssociatedTokenAddress(mint, payer.publicKey);
    const recipientATA = await getAssociatedTokenAddress(mint, recipient);

    const decimals = 6; 
    const transferAmount = Math.floor(amountToClaim * Math.pow(10, decimals));

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    const transaction = new Transaction().add(modifyComputeUnits).add(addPriorityFee);

    // 👇👇👇 核心功能：自动检测并开户 👇👇👇
    const recipientAccountInfo = await connection.getAccountInfo(recipientATA);
    if (!recipientAccountInfo) {
        console.log(`🆕 自动开户: ${wallet}`);
        transaction.add(
            createAssociatedTokenAccountInstruction(payer.publicKey, recipientATA, recipient, mint)
        );
    }
    // 👆👆👆

    // 转账指令
    transaction.add(createTransferInstruction(payerATA, recipientATA, payer.publicKey, transferAmount));

    transaction.recentBlockhash = (await connection.getLatestBlockhash('processed')).blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false, preflightCommitment: 'processed'
    });

    console.log(`✅ 释放成功: ${signature}`);

    // 4. 更新数据库
    // ⚠️ 全部领走后，locked_reward 归零，计时器重置
    const { error: updateError } = await supabase.from('users').update({ 
      locked_reward: 0, // 全部提走
      total_claimed: (user.total_claimed || 0) + amountToClaim,
      last_vesting_time: new Date().toISOString() // 重置倒计时，开始下一个30天
    }).eq('wallet', wallet);

    if (updateError) console.error("DB Update Error", updateError);

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
