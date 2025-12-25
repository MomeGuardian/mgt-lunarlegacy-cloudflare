import { NextResponse } from 'next/server';

// 强制使用 Edge Runtime
export const runtime = 'edge';

export async function POST(request: Request) {
  // 1. 进来先吼一声，看日志能不能印出来
  console.log("🟢 [DEBUG] Webhook 触发! 请求已到达 Cloudflare Edge.");

  try {
    // 2. 检查 URL 参数
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    console.log(`🔍 [DEBUG] 收到 Secret: ${secret?.slice(0, 3)}***`);

    if (secret !== process.env.HELIUS_WEBHOOK_SECRET) {
      console.error("🔴 [DEBUG] 权限验证失败!");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. 尝试解析 JSON (这是第一个耗时操作)
    console.log("🟡 [DEBUG] 正在解析 JSON Body...");
    const body = await request.json();
    
    // 打印一下收到了多少条交易
    const txCount = Array.isArray(body) ? body.length : 0;
    console.log(`✅ [DEBUG] JSON 解析成功! 包含 ${txCount} 笔交易.`);

    // 4. 什么都不做，直接返回成功
    console.log("🚀 [DEBUG] 测试通过，准备返回 200 OK.");
    
    return NextResponse.json({ 
      success: true, 
      message: "Debug Mode: Connection Successful",
      tx_received: txCount 
    });

  } catch (err: any) {
    console.error('💥 [DEBUG] 发生致命错误:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
