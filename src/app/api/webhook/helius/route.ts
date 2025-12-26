import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

async function getMgtPrice() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); 
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return parseFloat(data.pairs?.[0]?.priceUsd || FALLBACK_PRICE);
  } catch (error) {
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  console.log("👉 [Step 0] Webhook 收到请求...");
  
  try {
    const debugKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`🔍 [Debug] Key开头: ${debugKey ? debugKey.slice(0, 5) : 'MISSING'}...`);

    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== process.env.HELIUS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || !Array.isArray(body)) return NextResponse.json({ message: 'No tx' });

    console.log(`👉 [Step 1] 解析到 ${body.length} 条数据`);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const validTxsRaw = body.filter((tx: any) => !tx.transactionError);
    if (validTxsRaw.length === 0) return NextResponse.json({ message: 'No valid tx' });

    console.log("👉 [Step 2] 开始去重...");
    const signatures = validTxsRaw.map((tx: any) => tx.signature);
    
    const { data: existingRows, error: checkError } = await supabase
        .from('processed_txs')
        .select('signature')
        .in('signature', signatures);
    
    if (checkError) console.error("去重查询警告:", checkError.message);

    const existingSet = new Set(existingRows?.map((row: any) => row.signature) || []);
    const newSignatures = signatures.filter((s: string) => !existingSet.has(s));

    if (newSignatures.length === 0) {
        return NextResponse.json({ message: 'Skipped: All Duplicates' });
    }

    console.log(`👉 [Step 2.5] 写入 ${newSignatures.length} 个新锁...`);
    const { error: insertError } = await supabase
        .from('processed_txs')
        .insert(newSignatures.map((s: string) => ({ signature: s })));
    
    if (insertError) {
        console.log("⚠️ [Info] 写入锁可能有冲突 (安全跳过):", insertError.message);
    }

    const currentPrice = await getMgtPrice();
    const walletNetChanges: Record<string, number> = {};
    const walletLastSignature: Record<string, string> = {};
    console.log("👉 [Step 4] 内存计算...");
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
        console.log("✅ 没有有效金额变动");
        return NextResponse.json({ message: 'No significant value changes' });
    }

    console.log(`👉 [Step 5] 调用 RPC 处理 ${batchPayload.length} 个钱包...`);
    
    const { error: rpcError } = await supabase.rpc('process_helius_batch_v2', {
        updates: batchPayload,
        current_price: currentPrice
    });

    if (rpcError) {
        console.error("🔴 RPC Error:", rpcError);
        return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    console.log(`✅ [Success] 批量处理成功`);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('💥 Fatal Error:', err.message);
    return NextResponse.json({ success: true, error: err.message });
  }
}
