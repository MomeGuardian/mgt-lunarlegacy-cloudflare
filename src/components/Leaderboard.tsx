"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
// ✅ 改为引入你项目里现有的 supabase 客户端，避免 import 报错
import { supabase } from "@/lib/supabase";

// 定义数据接口
interface LeaderboardUser {
  wallet: string;
  referrals_count: number;
  pending_reward: number | null; // 允许为空，防止报错
  team_volume: number | null;
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取数据
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // 请求 API (确保你的 /api/leaderboard 已经修好了)
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        
        if (Array.isArray(data)) {
            setLeaders(data);
        } else {
            setLeaders([]); // 防止数据格式错误导致崩盘
        }
      } catch (error) {
        console.error("加载排行榜失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    
    // 开启实时订阅 (可选，如果数据库支持)
    const channel = supabase
      .channel('leaderboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchLeaderboard();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 骨架屏 (加载动画)
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse flex items-center px-4 gap-4">
            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
            <div className="w-24 h-4 bg-gray-700 rounded"></div>
            <div className="ml-auto w-16 h-4 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      
      {/* 表头 (仅在平板以上显示，手机端隐藏以节省空间) */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800/50">
        <div className="col-span-1 text-center">排名</div>
        <div className="col-span-4">用户</div>
        <div className="col-span-2 text-center">邀请人数</div>
        <div className="col-span-2 text-right">返现收益</div>
        <div className="col-span-3 text-right">状态</div>
      </div>

      <div className="flex flex-col gap-2 p-2 md:p-0">
        {leaders.length > 0 ? (
          leaders.map((user, index) => {
            // ✅ 核心修复：安全获取数值 (如果没有值，默认为 0)
            const safeReward = user.pending_reward || 0;
            const safeCount = user.referrals_count || 0;

            // ✅ 核心修复：计算与上一名的差距
            const prevUser = leaders[index - 1];
            // 只有当不是第一名(index > 0) 且 上一名存在时，才计算差距
            const gap = (index > 0 && prevUser) ? (prevUser.referrals_count || 0) - safeCount : 0;
            
            // 样式逻辑
            let rankBadge;
            let rowBgClass = "bg-[#16171D] border-gray-800/30";
            
            if (index === 0) {
              rankBadge = "🥇";
              rowBgClass = "bg-gradient-to-r from-yellow-900/20 to-[#16171D] border-yellow-500/30 shadow-[0_0_20px_-5px_rgba(234,179,8,0.1)]";
            } else if (index === 1) {
              rankBadge = "🥈";
              rowBgClass = "bg-gradient-to-r from-gray-700/20 to-[#16171D] border-gray-400/30";
            } else if (index === 2) {
              rankBadge = "🥉";
              rowBgClass = "bg-gradient-to-r from-orange-900/20 to-[#16171D] border-orange-500/30";
            } else {
              rankBadge = <span className="font-mono font-bold text-gray-500">#{index + 1}</span>;
            }

            return (
              <motion.div
                key={user.wallet}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`relative grid grid-cols-12 gap-2 md:gap-4 items-center p-4 rounded-xl border ${rowBgClass} transition-all hover:bg-white/5`}
              >
                {/* 1. 排名 */}
                <div className="col-span-2 md:col-span-1 flex justify-center items-center text-xl">
                  {rankBadge}
                </div>

                {/* 2. 用户信息 */}
                <div className="col-span-5 md:col-span-4 flex items-center gap-3 overflow-hidden">
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner
                    ${index === 0 ? 'bg-yellow-500 text-black' : 
                      index === 1 ? 'bg-gray-300 text-black' : 
                      index === 2 ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                    {user.wallet ? user.wallet.slice(0, 1) : "?"}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`font-mono text-sm font-bold truncate ${index < 3 ? 'text-white' : 'text-gray-400'}`}>
                      {user.wallet ? `${user.wallet.slice(0, 4)}...${user.wallet.slice(-4)}` : "Unknown"}
                    </span>
                    {index === 0 && <span className="text-[10px] text-yellow-500 font-bold hidden md:block">👑 军团长</span>}
                  </div>
                </div>

                {/* 3. 邀请数据 (手机端合并显示) */}
                <div className="col-span-5 md:col-span-2 flex flex-col md:items-center justify-center">
                  <p className="text-xs text-gray-500 md:hidden">邀请 / 收益</p>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-bold text-base">{safeCount}</span>
                    <span className="text-gray-600 text-xs">人</span>
                  </div>
                  {/* 手机端把收益显示在这里 */}
                  <div className="md:hidden mt-1 font-mono text-xs text-yellow-500">
                    {/* ✅ 这里加了 || 0，绝对不会报错了 */}
                    {safeReward.toFixed(2)} MGT
                  </div>
                </div>

                {/* 4. 收益 (仅电脑端独立显示) */}
                <div className="hidden md:block col-span-2 text-right font-mono font-bold text-yellow-500">
                  {/* ✅ 这里也加了安全值 */}
                  {safeReward.toFixed(2)} <span className="text-xs text-yellow-700">MGT</span>
                </div>

                {/* 5. 状态/差距 */}
                <div className="col-span-12 md:col-span-3 mt-2 md:mt-0 flex md:justify-end items-center border-t border-gray-800/50 pt-2 md:border-0 md:pt-0">
                  {index === 0 ? (
                    <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold flex items-center gap-1 w-full md:w-auto justify-center">
                      🔥 遥遥领先
                    </span>
                  ) : (
                    <div className="flex items-center justify-between w-full md:w-auto gap-2 text-xs">
                        <span className="text-gray-500">距上一名</span>
                        <span className="text-purple-400 font-mono font-bold">
                            -{gap} <span className="opacity-50">人</span>
                        </span>
                    </div>
                  )}
                </div>

              </motion.div>
            );
          })
        ) : (
          // 空状态
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-4xl mb-2">🏜️</span>
            <p>暂无数据，快来抢占沙发！</p>
          </div>
        )}
      </div>
    </div>
  );
}
