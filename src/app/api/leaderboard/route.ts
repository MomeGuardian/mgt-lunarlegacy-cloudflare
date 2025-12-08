// src/app/api/leaderboard/route.ts
import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    try {
    const { data: leaderboard, error } = await supabase
        .from("users")
        .select("wallet, referral_count, pending_reward")
        .order("referral_count", { ascending: false })
        .limit(20);

    if (error) throw error;

    // 加头像 URL（用 Solana 钱包头像 API）
    const formattedLeaderboard = leaderboard.map((user, index) => ({
        rank: index + 1,
        wallet: user.wallet,
        avatar: `https://avatar.sol/${user.wallet}`, // 自动生成头像
        referrals: user.referral_count,
        reward: user.pending_reward,
        gap: index > 0 ? leaderboard[index - 1].referral_count - user.referral_count : 0,
    }));

    return new Response(JSON.stringify(formattedLeaderboard), { status: 200 });
    } catch (err) {
        console.error("Leaderboard error:", err);
    return new Response("Error", { status: 500 });
    }
}