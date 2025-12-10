"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

interface LeaderboardUser {
  wallet: string;
  referrals_count: number;
  total_earned: number | null; // ✅ 改用历史总收益
  team_volume: number | null;  // ✅ 业绩(美元)
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取数据函数
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard'); // 调用刚才写的 API
      const data = await res.json();
      if (Array.isArray(data)) setLeaders(data);
    } catch (error) {
      console.error("加载失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // 实时订阅：当业绩变化时，刷新排行榜
    const channel = supabase.channel('lb_update').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchLeaderboard).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">正在载入战况...</div>;

  return (
    <div className="w-full">
      {/* 表头 */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800/50">
        <div className="col-span-1 text-center">排名</div>
        <div className="col-span-4">用户</div>
        <div className="col-span-2 text-center">直推人数</div>
        <div className="col-span-2 text-right">总收益 (MGT)</div>
        <div className="col-span-3 text-right">追赶目标 (USD)</div>
      </div>

      <div className="flex flex-col gap-2 p-2 md:p-0">
        {leaders.map((user, index) => {
          // 🛡️ 安全数值
          const volume = user.team_volume || 0;
          const earned = user.total_earned || 0;
          
          // 🧮 计算差距 (核心逻辑)
          const prevUser = leaders[index - 1];
          // 差距 = 上一名的业绩 - 我的业绩
          const gap = (index > 0 && prevUser) ? (prevUser.team_volume || 0) - volume : 0;

          // 样式处理
          let rankBadge = <span className="font-mono font-bold text-gray-500">#{index + 1}</span>;
          let rowClass = "bg-[#16171D] border-gray-800/30";

          // 👇 核心修改：给 emoji 加上 <span> 标签，这样它就变成了 Element，类型就一致了
          if (index === 0) { 
            rankBadge = <span className="text-2xl">🥇</span>; 
            rowClass = "bg-gradient-to-r from-yellow-900/20 to-[#16171D] border-yellow-500/30"; 
          }
          else if (index === 1) { 
            rankBadge = <span className="text-xl">🥈</span>; 
            rowClass = "bg-gradient-to-r from-gray-700/20 to-[#16171D] border-gray-400/30"; 
          }
          else if (index === 2) { 
            rankBadge = <span className="text-xl">🥉</span>; 
            rowClass = "bg-gradient-to-r from-orange-900/20 to-[#16171D] border-orange-500/30"; 
          }

          return (
            <motion.div
              key={user.wallet}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative grid grid-cols-12 gap-2 md:gap-4 items-center p-4 rounded-xl border ${rowClass}`}
            >
              {/* 1. 排名 */}
              <div className="col-span-2 md:col-span-1 flex justify-center text-xl">{rankBadge}</div>

              {/* 2. 用户 */}
              <div className="col-span-5 md:col-span-4 flex items-center gap-3 overflow-hidden">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gray-800 text-gray-400`}>
                  {user.wallet[0]}
                </div>
                <div className="flex flex-col">
                    <span className={`font-mono text-sm font-bold truncate ${index < 3 ? 'text-white' : 'text-gray-400'}`}>
                      {user.wallet.slice(0, 4)}...{user.wallet.slice(-4)}
                    </span>
                    {/* 显示个人业绩 */}
                    <span className="text-[10px] text-gray-600 md:hidden">业绩: ${volume.toFixed(2)}</span>
                </div>
              </div>

              {/* 3. 直推人数 */}
              <div className="hidden md:flex col-span-2 items-center justify-center gap-1">
                <span className="text-green-400 font-bold">{user.referrals_count}</span>
                <span className="text-gray-600 text-xs">人</span>
              </div>

              {/* 4. 总收益 (MGT) */}
              <div className="col-span-5 md:col-span-2 text-right">
                 <p className="text-xs text-gray-500 md:hidden">总赚取</p>
                 <span className="font-mono font-bold text-yellow-500">{earned.toFixed(2)}</span>
                 <span className="text-[10px] text-yellow-700 ml-1">MGT</span>
              </div>

              {/* 5. 差距 (USD) */}
              <div className="col-span-12 md:col-span-3 mt-2 md:mt-0 flex md:justify-end items-center border-t border-gray-800/50 pt-2 md:border-0 md:pt-0">
                {index === 0 ? (
                  <span className="text-xs font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full">🔥 业绩第一</span>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">距上一名差</span>
                    <span className="text-pink-500 font-mono font-bold">
                       ${gap.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
