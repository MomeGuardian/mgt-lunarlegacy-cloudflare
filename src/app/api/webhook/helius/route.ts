import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
// 🛡️ 保底价格：万一 API 全挂了，用这个价格算业绩
const FALLBACK_PRICE = 0.00013; 

// ⚡️ 1. 极速获取价格 (带 2秒 超时控制，防止 Helius 报错)
async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒后强制断开

    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await res.json();
    const price = parseFloat(data.pairs?.[0]?.priceUsd);
    
    if (price && !isNaN(price)) return price;
    throw new Error("无效价格");

  } catch (error) {
    console.warn("⚠️ 价格查询超时或失败，启用保底价:", FALLBACK_PRICE);
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
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 获取价格 (极速版)
    const currentPrice = await getMgtPrice();

    // 3. 处理逻辑
    const updates = [];

    for (const tx of body) {
      if (tx.transactionError) continue;

      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];

      // 🔥 核心修复：OKX 兼容逻辑 (不看 feePayer，只看谁收到了币)
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);

      for (const transfer of mgtTransfers) {
          const receiverWallet = transfer.toUserAccount; // 真正的买家
          const amount = parseFloat(transfer.tokenAmount);
          const usdValue = amount * currentPrice;

          if (usdValue < 0.1) continue; // 过滤垃圾交易

          // 把费时的数据库操作打包，稍后并发执行
          updates.push(async () => {
              // 查户口
              const { data: user } = await supabase
                .from('users')
                .select('referrer')
                .eq('wallet', receiverWallet)
                .single();

              if (user?.referrer) {
                  const referrer = user.referrer;
                  const reward = amount * 0.05; // 5%

                  console.log(`🚀 捕获业绩: ${referrer} +$${usdValue.toFixed(2)}`);

                  // A. 查重并记录
                  const { error: insertError } = await supabase.from('transactions').insert({
                      signature,
                      buyer: receiverWallet,
                      referrer: referrer,
                      token_amount: amount,
                      reward_amount: reward,
                      usdt_value: usdValue
                  });

                  if (!insertError) {
                      // B. 加业绩 (RPC)
                      await supabase.rpc('increment_team_volume', {
                          wallet_address: referrer, 
                          amount_to_add: usdValue
                      });
                      // C. 加奖励 (RPC)
                      await supabase.rpc('increment_pending_reward', {
                          wallet_address: referrer, 
                          reward_to_add: reward
                      });
                  } else {
                      console.log("⚠️ 交易已存在，跳过奖励发放");
                  }
              }
          });
      }
    }

    // 4. 并发执行所有数据库操作，最大限度节省时间
    await Promise.allSettled(updates.map(fn => fn()));

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Webhook Error:', err);
    // 即使出错也返回 200，防止 Helius 疯狂重试
    return NextResponse.json({ success: true, error: err.message });
  }
}
