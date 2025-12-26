import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MGT_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const FALLBACK_PRICE = 0.00013; 

async function getMgtPrice() {
  console.log("👉 [Step 3] 开始查询币价...");
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); 
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${MGT_MINT}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    const price = parseFloat(data.pairs?.[0]?.priceUsd || FALLBACK_PRICE);
    console.log(`✅ [Step 3] 币价查询成功: ${price}`);
    return price;
  } catch (error) {
    console.log("⚠️ [Step 3] 价格查询超时，使用默认价格");
    return FALLBACK_PRICE;
  }
}

export async function POST(request: Request) {
  console.log("👉 [Step 0] Webhook 收到请求，开始处理...");
  
  try {
    const debugUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const debugKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log(`🔍 [Debug环境] Supabase URL: ${debugUrl}`);
    console.log(`🔍 [Debug环境] Key 开头: ${debugKey ? debugKey.slice(0, 5) : 'UNDEFINED'}...`);
    console.log(`🔍 [Debug环境] Key 长度: ${debugKey ? debugKey.length : 0}`);

    if (!debugUrl || !debugKey) {
         throw new Error("环境变量缺失！无法连接数据库！");
    }

    const body = await request.json();
    if (!body || !Array.isArray(body)) {
        console.log("⚠️ [Info] Body 为空或格式错误");
        return NextResponse.json({ message: 'No tx' });
    }
    console.log(`👉 [Step 1] 解析到 ${body.length} 条交易数据`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const validTxsRaw = body.filter((tx: any) => !tx.transactionError);
    if (validTxsRaw.length === 0) return NextResponse.json({ message: 'No valid tx' });

    console.log("👉 [Step 2] 开始去重检查...");
    const signatures = validTxsRaw.map((tx: any) => tx.signature);
    
    const { data: existingRows, error: checkError } = await supabase
        .from('processed_txs')
        .select('signature')
        .in('signature', signatures);

    if (checkError) {
        console.error("🔴 [Error] 去重查询失败:", checkError.message);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }
    
    const existingSet = new Set(existingRows?.map((row: any) => row.signature) || []);
    const newSignatures = signatures.filter((s: string) => !existingSet.has(s));

    if (newSignatures.length === 0) {
        console.log("✅ [Step 2] 全部为重复交易，跳过");
        return NextResponse.json({ message: 'Skipped: All Duplicates' });
    }
    console.log(`👉 [Step 2] 发现 ${newSignatures.length} 条新交易，准备写入锁...`);

    await supabase.from('processed_txs').insert(
        newSignatures.map((s: string) => ({ signature: s }))
    ).select().maybeSingle().catch(() => {});

    const currentPrice = await getMgtPrice();
    const walletNetChanges: Record<string, number> = {};
    const walletLastSignature: Record<string, string> = {};

    console.log("👉 [Step 4] 开始在内存中计算钱包变动...");
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
        console.log("✅ [Info] 没有有效金额变动");
        return NextResponse.json({ message: 'No value changes' });
    }

    console.log(`👉 [Step 5] 准备调用 RPC 超级函数，处理 ${batchPayload.length} 个钱包...`);
    
    const { error: rpcError } = await supabase.rpc('process_helius_batch_v2', {
        updates: batchPayload,
        current_price: currentPrice
    });

    if (rpcError) {
        console.error("🔴 [Fatal Error] RPC 调用失败:", rpcError);
        console.error("🔴 [Debug] 错误详情:", rpcError.message, rpcError.details);
        return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    console.log(`✅ [Success] 批量处理成功！`);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('💥 [Fatal Catch] 代码崩溃:', err.message);
    return NextResponse.json({ success: true, error: err.message });
  }
}

