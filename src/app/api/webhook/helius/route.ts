import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

// 1. 查价格 (带超时保护)
async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); 
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return parseFloat(data.pairs?.[0]?.priceUsd || FALLBACK_PRICE);
  } catch (error) {
    console.log("⚠️ 价格查询超时，使用默认价格");
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

    // 初始化 Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 批量去重 (只做一次数据库查询)
    const validTxsRaw = body.filter((tx: any) => !tx.transactionError);
    if (validTxsRaw.length === 0) return NextResponse.json({ message: 'No valid tx' });

    const signatures = validTxsRaw.map((tx: any) => tx.signature);
    const { data: existingRows } = await supabase
        .from('processed_txs')
        .select('signature')
        .in('signature', signatures);
    
    const existingSet = new Set(existingRows?.map((row: any) => row.signature) || []);
    const newSignatures = signatures.filter((s: string) => !existingSet.has(s));

    if (newSignatures.length === 0) {
        return NextResponse.json({ message: 'Skipped: All Duplicates' });
    }

    // 写入去重锁 (一次性写入，忽略冲突)
    await supabase.from('processed_txs').insert(
        newSignatures.map((s: string) => ({ signature: s }))
    ).select().maybeSingle().catch(() => {});

    // 3. 准备数据包
    const currentPrice = await getMgtPrice();
    const walletNetChanges: Record<string, number> = {};
    const walletLastSignature: Record<string, string> = {};

    // 纯内存计算，极快
    for (const tx of validTxsRaw) {
      if (existingSet.has(tx.signature)) continue;
      const signature = tx.signature;
      const transfers = tx.tokenTransfers || [];
      const mgtTransfers = transfers.filter((t: any) => t.mint === MGT_MINT);
      
      for (const t of mgtTransfers) {
          const amount = parseFloat(t.tokenAmount);
          if (t.toUserAccount) {
              walletNetChanges[t.toUserAccount] = (walletNetChanges[t.toUserAccount] || 0) + amount;
              walletLastSignature[t.toUserAccount] = signature;
          }
          if (t.fromUserAccount) {
              walletNetChanges[t.fromUserAccount] = (walletNetChanges[t.fromUserAccount] || 0) - amount;
              walletLastSignature[t.fromUserAccount] = signature;
          }
      }
    }

    const batchPayload = Object.entries(walletNetChanges)
        .filter(([_, amount]) => Math.abs(amount * currentPrice) >= 0.01)
        .map(([wallet, amount]) => ({
            wallet: wallet,
            amount: amount,
            signature: walletLastSignature[wallet]
        }));

    if (batchPayload.length === 0) {
        return NextResponse.json({ message: 'No value changes' });
    }

    // 4. 发射！(调用数据库超级函数)
    const { error: rpcError } = await supabase.rpc('process_helius_batch_v2', {
        updates: batchPayload,
        current_price: currentPrice
    });

    if (rpcError) {
        console.error("RPC Error:", rpcError);
        return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    console.log(`✅ 成功处理 ${batchPayload.length} 个钱包变动`);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Fatal:', err.message);
    return NextResponse.json({ success: true, error: err.message });
  }
}
