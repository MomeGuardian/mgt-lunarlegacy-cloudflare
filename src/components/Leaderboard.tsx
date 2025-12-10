"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";

// 定义数据接口
interface LeaderboardUser {
  wallet: string;
  referrals_count: number;
  pending_reward: number | null;
  team_volume: number | null;
}

// 🎨 子组件：单行排名 (为了复用样式逻辑)
const LeaderboardRow = ({ user, index, prevUser, isCompact = false }: { 
    user: LeaderboardUser; 
    index: number; 
    prevUser?: LeaderboardUser; 
    isCompact?: boolean; // 控制是否为紧凑模式(弹窗用)
}) => {
    // 安全数值
    const safeReward = user.pending_reward || 0;
    const safeCount = user.referrals_count || 0;
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
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`relative grid grid-cols-12 gap-2 md:gap-4 items-center ${isCompact ? 'p-3' : 'p-4'} rounded-xl border ${rowBgClass} transition-all hover:bg-white/5`}
        >
            {/* 1. 排名 */}
            <div className="col-span-2 md:col-span-1 flex justify-center items-center text-lg">
                {rankBadge}
            </div>

            {/* 2. 用户信息 (头像根据 isCompact 变大小) */}
            <div className="col-span-5 md:col-span-4 flex items-center gap-3 overflow-hidden">
                <div className={`${isCompact ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full flex items-center justify-center font-bold shadow-inner flex-shrink-0
                ${index === 0 ? 'bg-yellow-500 text-black' : 
                    index === 1 ? 'bg-gray-300 text-black' : 
                    index === 2 ? 'bg-orange-500 text-black' : 'bg-gray-800 text-gray-400'}`}>
                {user.wallet ? user.wallet.slice(0, 1) : "?"}
                </div>
                <div className="flex flex-col min-w-0">
                <span className={`font-mono ${isCompact ? 'text-xs' : 'text-sm'} font-bold truncate ${index < 3 ? 'text-white' : 'text-gray-400'}`}>
                    {user.wallet ? `${user.wallet.slice(0, 4)}...${user.wallet.slice(-4)}` : "Unknown"}
                </span>
                {index === 0 && !isCompact && <span className="text-[10px] text-yellow-500 font-bold hidden md:block">👑 军团长</span>}
                </div>
            </div>

            {/* 3. 邀请数据 */}
            <div className="col-span-5 md:col-span-2 flex flex-col md:items-center justify-center">
                <div className="flex items-center gap-1 md:gap-2">
                <span className={`text-green-400 font-bold ${isCompact ? 'text-sm' : 'text-base'}`}>{safeCount}</span>
                <span className="text-gray-600 text-xs">人</span>
                </div>
                <div className="md:hidden mt-0.5 font-mono text-xs text-yellow-500">
                {safeReward.toFixed(2)} MGT
                </div>
            </div>

            {/* 4. 收益 (电脑端) */}
            <div className="hidden md:block col-span-2 text-right font-mono font-bold text-yellow-500 text-sm">
                {safeReward.toFixed(2)} <span className="text-xs text-yellow-700">MGT</span>
            </div>

            {/* 5. 状态/差距 */}
            <div className="col-span-12 md:col-span-3 mt-2 md:mt-0 flex md:justify-end items-center border-t border-gray-800/50 pt-2 md:border-0 md:pt-0">
                {index === 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px] font-bold flex items-center gap-1 w-full md:w-auto justify-center">
                    🔥 领跑
                </span>
                ) : (
                <div className="flex items-center justify-between w-full md:w-auto gap-2 text-[10px] md:text-xs">
                    <span className="text-gray-600">距上名</span>
                    <span className="text-purple-400 font-mono font-bold">
                        -{gap}
                    </span>
                </div>
                )}
            </div>
        </motion.div>
    );
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  // ✅ 控制弹窗显示
  const [showAllModal, setShowAllModal] = useState(false);

  // 获取数据
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        
        if (Array.isArray(data)) {
            setLeaders(data);
        } else {
            setLeaders([]); 
        }
      } catch (error) {
        console.error("加载排行榜失败:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    
    // 开启实时订阅
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

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-800/50 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      
      {/* 表头 */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800/50">
        <div className="col-span-1 text-center">排名</div>
        <div className="col-span-4">用户</div>
        <div className="col-span-2 text-center">邀请人数</div>
        <div className="col-span-2 text-right">返现金额</div>
        <div className="col-span-3 text-right">状态</div>
      </div>

      <div className="flex flex-col gap-2 p-2 md:p-0">
        {leaders.length > 0 ? (
          <>
            {/* ✅ 默认只显示前 10 名 */}
            {leaders.slice(0, 10).map((user, index) => (
              <LeaderboardRow 
                key={user.wallet} 
                user={user} 
                index={index} 
                prevUser={leaders[index - 1]} 
              />
            ))}

            {/* ✅ 查看更多按钮 (只有当数据超过10条时显示) */}
            {leaders.length > 10 && (
                <button 
                    onClick={() => setShowAllModal(true)}
                    className="mt-4 w-full py-3 bg-[#1A1B23] hover:bg-[#252630] text-gray-400 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-gray-800 hover:border-gray-600"
                >
                    <span>👀 查看前 30 名精英</span>
                </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-4xl mb-2">🏜️</span>
            <p>暂无数据</p>
          </div>
        )}
      </div>

      {/* ✅✅✅ 完整排行榜弹窗 (Top 30) ✅✅✅ */}
      <AnimatePresence>
        {showAllModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-lg bg-[#111] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                >
                    {/* 弹窗头部 */}
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#16171D]">
                        <div>
                            <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                🏆 完整风云榜 (Top 30)
                            </h3>
                            <p className="text-xs text-gray-500">实时数据更新中...</p>
                        </div>
                        <button 
                            onClick={() => setShowAllModal(false)}
                            className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 弹窗列表 (可滚动) */}
                    <div className="overflow-y-auto p-3 flex-1 custom-scrollbar">
                        <div className="flex flex-col gap-2">
                            {/* 显示前 30 名 */}
                            {leaders.slice(0, 30).map((user, index) => (
                                <LeaderboardRow 
                                    key={`modal-${user.wallet}`} 
                                    user={user} 
                                    index={index} 
                                    prevUser={leaders[index - 1]}
                                    isCompact={true} // ✅ 开启紧凑模式：头像变小，间距变小
                                />
                            ))}
                        </div>
                        {leaders.length > 30 && (
                            <p className="text-center text-xs text-gray-600 mt-4 pb-2">
                                仅展示前 30 名，继续努力上榜吧！🚀
                            </p>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
}