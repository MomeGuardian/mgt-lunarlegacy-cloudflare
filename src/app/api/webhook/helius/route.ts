import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

// 1. 价格查询 (保持防超时)
async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 

    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await res.json();
    const price = parseFloat(data.pairs?.[0]?.priceUsd);
    
    if (price && !isNaN(price)) return price;
    throw new Error("无效价格");
  } catch (error) {
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const currentPrice = await getMgtPrice();
    const updates = [];

    for (const tx of body) {
      if (tx.transactionError) continue;

      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];

      // 🔥 调试日志：打印所有涉及 MGT 的转账，看看 OKX 到底干了啥
      const allMgtActions = transfers.filter((t: any) => t.mint === MGT_MINT);
      console.log(`🔍 交易 ${signature.slice(0,6)} 包含 ${allMgtActions.length} 笔 MGT 变动`);

      if (allMgtActions.length === 0) continue;

      // 🔥 终极兼容：遍历所有 MGT 变动，只要有人“收到了钱”，就去数据库查他是不是用户
      for (const transfer of allMgtActions) {
          const receiverWallet = transfer.toUserAccount; // 可能是用户，也可能是路由
          const amount = parseFloat(transfer.tokenAmount);

          // 必须是“正数”且大于0 (排除支出)
          if (amount <= 0) continue; 
          
          const usdValue = amount * currentPrice;
          if (usdValue < 0.1) continue; 

          // ⚡️ 这里是关键：不管这笔转账是主要转账还是中间转账
          // 直接去数据库问：“这个 receiverWallet 是我们的注册用户吗？”
          // 如果是路由合约，数据库查不到，自然就跳过了。
          // 如果是 B 钱包，数据库能查到，就触发奖励！
          
          updates.push(async () => {
              const { data: user } = await supabase
                .from('users')
                .select('referrer, wallet') // 多查一个 wallet 确认
                .eq('wallet', receiverWallet)
                .single();

              // 只有当“收钱的人”真实存在于我们的 users 表，并且有上级时
              if (user && user.referrer) {
                  const referrer = user.referrer;
                  const reward = amount * 0.05; 

                  console.log(`🎯 命中OKX/移动端交易!`);
                  console.log(`👤 买家: ${receiverWallet} (数据库已认证)`);
                  console.log(`💰 发奖给: ${referrer}`);

                  // A. 查重
                  const { error: insertError } = await supabase.from('transactions').insert({
                      signature,
                      buyer: receiverWallet,
                      referrer: referrer,
                      token_amount: amount,
                      reward_amount: reward,
                      usdt_value: usdValue
                  });

                  // B. 加钱
                  if (!insertError) {
                      await supabase.rpc('increment_team_volume', {
                          wallet_address: referrer, 
                          amount_to_add: usdValue
                      });
                      await supabase.rpc('increment_pending_reward', {
                          wallet_address: referrer, 
                          reward_to_add: reward
                      });
                  } else {
                      console.log("⚠️ 交易重复，跳过");
                  }
              }
          });
      }
    }

    await Promise.allSettled(updates.map(fn => fn()));
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ success: true, error: err.message });
  }
}
