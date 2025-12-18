import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
    Connection, 
    Keypair, 
    PublicKey, 
    Transaction, 
    ComputeBudgetProgram 
} from '@solana/web3.js';
// 👇 1. 新增引入 createAssociatedTokenAccountInstruction
import { 
    getAssociatedTokenAddress, 
    createTransferInstruction, 
    createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import bs58 from 'bs58';

export const runtime = 'edge';

// ⚙️ 配置：释放周期 (30天)
const VESTING_DAYS = 30;

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();
    
    // 1. 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 查余额 (保持你的逻辑: total_claimed 和 last_vesting_time)
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('locked_reward, total_claimed, last_vesting_time')
      .eq('wallet', wallet)
      .single();

    if (dbError || !user) throw new Error("User not found");

    // 🔥🔥 30天线性释放算法 (完全保留你的逻辑) 🔥🔥
    const now = Date.now();
    const lastTime = user.last_vesting_time ? new Date(user.last_vesting_time).getTime() : now;
    
    const currentLocked = user.locked_reward || 0;
    const claimedSoFar = user.total_claimed || 0;
    
    // 总权益 = 还没领的 + 已经领的
    const totalPool = currentLocked + claimedSoFar;

    if (totalPool <= 0.000001) {
      return NextResponse.json({ success: true, amount: 0, message: "暂无资产" });
    }

    // 计算过去了多少毫秒
    const msPassed = now - lastTime;
    // 换算成天
    const daysPassed = msPassed / (1000 * 60 * 60 * 24);

    // 每天释放多少
    const dailyRate = totalPool / VESTING_DAYS;

    // 本次能领多少
    let amountToClaim = dailyRate * daysPassed;

    // 🛡️ 限制 1: 不能超过当前余额
    if (amountToClaim > currentLocked) {
        amountToClaim = currentLocked;
    }

    // 🛡️ 限制 2: 最小提现门槛
    if (amountToClaim < 0.1) {
        return NextResponse.json({ 
            success: false, 
            error: `积累太少，满 0.1 MGT 可领。当前积攒: ${amountToClaim.toFixed(4)}` 
        }, { status: 400 });
    }

    console.log(`🧮 线性计算: 总盘 ${totalPool} | 过去 ${daysPassed.toFixed(4)} 天 | 本次释放 ${amountToClaim}`);

    // 3. 准备转账 (⚡️ 极速模式 + 自动开户)
    const privateKey = process.env.PAYER_PRIVATE_KEY;
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!, 'processed');
    
    const payer = Keypair.fromSecretKey(bs58.decode(privateKey));
    const mint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_MINT!); 
    const recipient = new PublicKey(wallet);

    const payerATA = await getAssociatedTokenAddress(mint, payer.publicKey);
    const recipientATA = await getAssociatedTokenAddress(mint, recipient);

    const decimals = 6; 
    const transferAmount = Math.floor(amountToClaim * Math.pow(10, decimals));

    // 稍微提高一点计算预算，因为可能要执行“创建账户”指令
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 });

    const transaction = new Transaction()
      .add(modifyComputeUnits)
      .add(addPriorityFee);

    // 👇👇👇 核心逻辑：检查并自动创建账户 👇👇👇
    // 先去链上查一下，这个收款地址存在吗？
    const recipientAccountInfo = await connection.getAccountInfo(recipientATA);

    if (!recipientAccountInfo) {
        console.log(`🆕 检测到新用户 ${wallet} (无 SOL/无户头)，正在协助开户...`);
        // 增加一条指令：由 payer (项目方) 出钱帮用户开户
        transaction.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey, // 付钱的人 (0.002 SOL)
                recipientATA,    // 要创建的账户地址
                recipient,       // 账户的主人 (用户)
                mint             // 代币类型 (MGT)
            )
        );
    }
    // 👆👆👆 核心逻辑结束 👆👆👆

    // 最后添加转账指令
    transaction.add(createTransferInstruction(payerATA, recipientATA, payer.publicKey, transferAmount));

    transaction.recentBlockhash = (await connection.getLatestBlockhash('processed')).blockhash;
    transaction.feePayer = payer.publicKey;
    transaction.sign(payer);

    console.log(`💸 发送交易...`);
    
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'processed'
    });

    console.log(`✅ 交易广播: ${signature}`);

    // 4. 更新数据库 (保持你的逻辑)
    const { error: updateError } = await supabase.from('users').update({ 
      locked_reward: currentLocked - amountToClaim, // 余额变少
      total_claimed: claimedSoFar + amountToClaim,  // 已领变多
      last_vesting_time: new Date().toISOString()   // 重置闹钟
    }).eq('wallet', wallet);

    if (updateError) console.error("DB Update Error", updateError);

    // 5. 返回
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
