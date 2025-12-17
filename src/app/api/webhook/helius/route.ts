import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00012; 

async function getMgtPrice() {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`);
    const data = await res.json();
    return parseFloat(data.pairs?.[0]?.priceUsd || FALLBACK_PRICE);
  } catch (error) {
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  try {
    // 1. 验证
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No transactions' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();

    for (const tx of body) {
      if (tx.transactionError) continue;

      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];

      // 🔥 核心修复 1: 过滤出所有涉及 MGT 的转账 (可能有好几条)
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);

      if (mgtTransfers.length === 0) continue;

      // 🔥 核心修复 2: 遍历每一条转账，看“接收者”是不是我们的用户
      for (const transfer of mgtTransfers) {
          const receiverWallet = transfer.toUserAccount; // 收钱的人
          const amount = parseFloat(transfer.tokenAmount);
          const usdValue = amount * currentPrice;

          // 过滤小额垃圾
          if (usdValue < 0.1) continue;

          // 查重 (防止重复计算)
          // 注意：这里我们用 signature + receiver 做组合查重，防止一笔交易分两笔转给同一个人导致报错
          // 简化版：直接查 signature，如果已存在则跳过整单 (通常一单买入只会涉及一次用户收币)
          const { data: exist } = await supabase.from('transactions').select('id').eq('signature', signature).single();
          if (exist) {
              console.log(`⚠️ 交易 ${signature.slice(0,6)} 已处理过`);
              break; // 跳出当前交易循环
          }

          // 查户口：这个收钱的人(receiverWallet)，有没有上级？
          const { data: user } = await supabase
            .from('users')
            .select('referrer')
            .eq('wallet', receiverWallet)
            .single();

          // 只有当“收钱的人”有上级时，才触发奖励
          if (user?.referrer) {
              const referrer = user.referrer;
              const reward = amount * 0.05; // 5%

              console.log(`🚀 捕获买入: 用户 ${receiverWallet} 买入 (上级: ${referrer})`);
              console.log(`💰 发放奖励: ${reward} MGT (价值 $${usdValue.toFixed(2)})`);

              // A. 记录流水
              await supabase.from('transactions').insert({
                  signature,
                  buyer: receiverWallet,
                  referrer: referrer,
                  token_amount: amount,
                  reward_amount: reward,
                  usdt_value: usdValue
              });

              // B. 更新业绩 (RPC)
              await supabase.rpc('increment_team_volume', {
                  wallet_address: referrer,
                  amount_to_add: usdValue
              });

              // C. 更新奖励余额 (RPC) - 用我们之前写的那个 SQL 函数！
              const { error: rpcError } = await supabase.rpc('increment_pending_reward', {
                  wallet_address: referrer,
                  reward_to_add: reward
              });

              if (rpcError) console.error("❌ RPC更新奖励失败:", rpcError);
              
              // 找到一个有效买入后，通常这笔交易就处理完了，break 防止重复计算
              break; 
          }
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
