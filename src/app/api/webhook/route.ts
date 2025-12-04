// src/app/api/webhook/route.ts
import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

const TOKEN_MINT = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
const DECIMALS = 4;
const REWARD_RATE = 0.05;

export async function POST(req: NextRequest) {
  try {
    const body: any = await req.json();

    for (const tx of body) {
      if (!tx.tokenTransfers?.length) continue;

      for (const t of tx.tokenTransfers) {
        if (t.mint !== TOKEN_MINT) continue;

        const rawAmount = Number(t.tokenAmount || 0);
        if (rawAmount <= 0) continue;

        const realAmount = rawAmount / Math.pow(10, DECIMALS);
        const buyer = t.toUserAccount || t.toOwner;
        if (!buyer) continue;

        const { data: buyerData } = await supabase
          .from("users")
          .select("referrer")
          .eq("wallet", buyer)
          .single();

        if (!buyerData?.referrer) continue;

        const reward = realAmount * REWARD_RATE;

        // 终极稳妥写法：先查询当前值，再更新（完全避开 raw 类型坑）
        const { data: currentUser } = await supabase
          .from("users")
          .select("pending_reward")
          .eq("wallet", buyerData.referrer)
          .single();

        const currentReward = Number(currentUser?.pending_reward || 0);
        const newReward = currentReward + reward;

        await supabase
          .from("users")
          .update({
            pending_reward: supabase.raw(`pending_reward + ${reward}`),
          })
          .eq("wallet", buyerData.referrer);

      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
}
