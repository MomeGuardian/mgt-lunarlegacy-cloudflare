import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

// 1. 价格查询 (防超时)
async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    const price = parseFloat(data.pairs?.[0]?.priceUsd);
    if (price && !isNaN(price)) return price;
    return FALLBACK_PRICE;
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
      
      // 🛡️ 查重第一关：如果这笔交易已经处理过，直接跳过整单
      // 这能防止 Helius 重复推送导致的翻倍
      const { data: exist } = await supabase.from('transactions').select('id').eq('signature', signature).single();
      if (exist) {
          console.log(`⚠️ 交易已存在，跳过: ${signature.slice(0,6)}`);
          continue;
      }

      const transfers = tx.tokenTransfers || [];
      // 过滤出 MGT 的转账
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);
      if (mgtTransfers.length === 0) continue;

      // 🧮 核心修复：计算“净余额变动” (Net Balance Change)
      // 不管中间转了多少次，我们只算每个钱包最终多了多少钱
      const balanceChanges: Record<string, number> = {};

      for (const t of mgtTransfers) {
          const amount = parseFloat(t.tokenAmount);
          // 收钱：加
          if (t.toUserAccount) {
              balanceChanges[t.toUserAccount] = (balanceChanges[t.toUserAccount] || 0) + amount;
          }
          // 出钱：减 (虽然这里主要是买入，但防止路由中转导致重复计算)
          if (t.fromUserAccount) {
              balanceChanges[t.fromUserAccount] = (balanceChanges[t.fromUserAccount] || 0) - amount;
          }
      }

      // 遍历所有发生了资金变动的钱包
      for (const [wallet, netAmount] of Object.entries(balanceChanges)) {
          // 只有“净买入” (余额增加) 且金额有效时才处理
          const usdValue = netAmount * currentPrice;
          
          if (netAmount <= 0 || usdValue < 0.1) continue;

          updates.push(async () => {
              // 1. 查这个钱包是不是我们的用户
              const { data: user } = await supabase
                .from('users')
                .select('referrer')
                .eq('wallet', wallet)
                .single();

              // 2. 如果是用户且有上级
              if (user && user.referrer) {
                  const referrer = user.referrer;
                  const reward = netAmount * 0.05; // 5%

                  console.log(`🎯 净买入结算: ${wallet} +${netAmount} MGT`);
                  
                  // A. 插入流水 (利用数据库唯一索引做第二道防线)
                  const { error: insertError } = await supabase.from('transactions').insert({
                      signature, // 唯一键
                      buyer: wallet,
                      referrer: referrer,
                      token_amount: netAmount, // 记录净买入量
                      reward_amount: reward,
                      usdt_value: usdValue
                  });

                  // B. 只有插入成功(不重复)才发钱
                  if (!insertError) {
                      console.log(`💰 发放奖励: ${referrer} +${reward}`);
                      
                      // 更新业绩
                      await supabase.rpc('increment_team_volume', {
                          wallet_address: referrer, 
                          amount_to_add: usdValue
                      });
                      
                      // 🔥 更新奖励 (修复不显示的问题)
                      // 务必确保 increment_pending_reward 函数在数据库里是存在的
                      await supabase.rpc('increment_pending_reward', {
                          wallet_address: referrer, 
                          reward_to_add: reward
                      });
                  } else {
                      console.log("⚠️ 数据库查重拦截，防止重复发奖");
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
