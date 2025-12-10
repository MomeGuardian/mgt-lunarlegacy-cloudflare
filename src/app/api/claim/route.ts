import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import bs58 from 'bs58';

// MGT 代币合约地址
const MGT_MINT = new PublicKey("59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump");
// MGT 的精度
const DECIMALS = 6; 

export async function POST(request: Request) {
  try {
    const { wallet } = await request.json();

    if (!wallet) return NextResponse.json({ error: 'Wallet required' }, { status: 400 });

    // 1. 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 查询余额
    const { data: user, error } = await supabase
      .from('users')
      .select('pending_reward')
      .eq('wallet', wallet)
      .single();

    if (error || !user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    const amountToClaim = user.pending_reward;

    if (amountToClaim < 1) { 
      return NextResponse.json({ error: '余额不足 1 MGT' }, { status: 400 });
    }

    // 3. 连接 Solana
    // 建议使用 Helius RPC 或 Alchemy，公共节点容易限流
    const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
    
    const secretKeyString = process.env.PAYER_PRIVATE_KEY!;
    if (!secretKeyString) throw new Error("服务器未配置私钥");

    // 解析私钥
    let secretKey;
    try {
        secretKey = bs58.decode(secretKeyString);
    } catch (e) {
        throw new Error("私钥格式错误，请检查环境变量");
    }
    const payer = Keypair.fromSecretKey(secretKey);

    console.log(`处理提现: ${wallet} 提取 ${amountToClaim} MGT`);

    // 4. 构建交易
    const transaction = new Transaction();
    const destinationWallet = new PublicKey(wallet);

    // A. 获取国库 ATA (源头)
    const sourceATA = await getAssociatedTokenAddress(MGT_MINT, payer.publicKey);
    
    // B. 获取用户 ATA (目的地)
    const destATA = await getAssociatedTokenAddress(MGT_MINT, destinationWallet);

    // 🔍 关键修复：检查用户 ATA 是否存在
    const destAccountInfo = await connection.getAccountInfo(destATA);

    if (!destAccountInfo) {
        console.log("用户没有 MGT 账户，正在自动创建...");
        // 添加“创建账户”指令 (Payer 付租金，用户不需要出钱)
        transaction.add(
            createAssociatedTokenAccountInstruction(
                payer.publicKey, // 付款人 (国库)
                destATA,         // 要创建的 ATA
                destinationWallet, // 归属人 (用户)
                MGT_MINT         // 代币类型
            )
        );
    }

    // C. 添加转账指令
    const amountInSmallestUnit = BigInt(Math.floor(amountToClaim * Math.pow(10, DECIMALS)));
    
    transaction.add(
      createTransferInstruction(
        sourceATA,
        destATA,
        payer.publicKey,
        amountInSmallestUnit
      )
    );

    // 5. 发送交易
    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log(`✅ 提现成功! Hash: ${signature}`);

    // 6. 扣除余额
    const { error: updateError } = await supabase
      .from('users')
      .update({ pending_reward: 0 })
      .eq('wallet', wallet);

    if (updateError) {
        console.error("数据库扣款失败，请人工核对:", wallet);
    } else {
        // 记录流水
        await supabase.from('transactions').insert({
            signature: signature,
            buyer: wallet,
            token_amount: -amountToClaim,
            reward_amount: 0,
            referrer: 'SYSTEM_CLAIM'
        });
    }

    return NextResponse.json({ success: true, signature });

  } catch (err: any) {
    console.error('Claim Error:', err);
    
    // 返回具体错误给前端
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ 
        error: `提现失败: ${errorMessage}` 
    }, { status: 500 });
  }
}