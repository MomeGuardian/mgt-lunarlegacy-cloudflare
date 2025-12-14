"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from '@supabase/supabase-js'; // ✅ 改用基础库，你肯定有

// ✅ 1. 定义 Props
interface Props {
  currentUserWallet?: string;
}

interface LeaderboardUser {
  wallet: string;
  referrals_count: number;
  total_earned: number | null;
  team_volume: number | null;
}

// ✅ 初始化客户端 (放在组件外，防止重复创建)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ✅ 2. 组件定义
export default function Leaderboard({ currentUserWallet }: Props) {
  const [leaders, setLeaders] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取数据
  const fetchLeaderboard = async () => {
    try {
      // 直接查视图
      const { data, error } = await supabase
        .from('leaderboard_view')
        .select('*')
        .limit(50);
      
      if (error) throw error;
      setLeaders(data || []);
    } catch (error) {
      console.error("加载失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // 实时订阅
    const channel = supabase.channel('lb_update').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchLeaderboard).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // 计算我的排名
  const myIndex = leaders.findIndex(l => l.wallet === currentUserWallet);
  const myData = myIndex !== -1 ? leaders[myIndex] : null;

  if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">正在载入战况...</div>;

  return (
    <div className="w-full h-full flex flex-col bg-[#16171D] relative overflow-hidden">
      
      {/* --- 表头 --- */}
      <div className="shrink-0 hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800/50 bg-[#16171D] z-10">
        <div className="col-span-1 text-center">排名</div>
        <div className="col-span-4">用户</div>
        <div className="col-span-2 text-center">直推人数</div>
        <div className="col-span-2 text-right">总收益 (MGT)</div>
        <div className="col-span-3 text-right">追赶目标 (USD)</div>
      </div>

      {/* --- 列表 --- */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2"> 
        {leaders.map((user, index) => {
          const volume = user.team_volume || 0;
          const earned = user.total_earned || 0;
          const prevUser = leaders[index - 1];
          const gap = (index > 0 && prevUser) ? (prevUser.team_volume || 0) - volume : 0;
          const isMe = user.wallet === currentUserWallet;

          let rankBadge: React.ReactNode = <span className="font-mono font-bold text-gray-500">#{index + 1}</span>;
          let rowClass = "bg-[#16171D] border-gray-800/30";
          if (isMe) rowClass = "bg-blue-900/20 border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]";

          if (index === 0) { rankBadge = "🥇"; if(!isMe) rowClass = "bg-gradient-to-r from-yellow-900/20 to-[#16171D] border-yellow-500/30"; }
          else if (index === 1) { rankBadge = "🥈"; if(!isMe) rowClass = "bg-gradient-to-r from-gray-700/20 to-[#16171D] border-gray-400/30"; }
          else if (index === 2) { rankBadge = "🥉"; if(!isMe) rowClass = "bg-gradient-to-r from-orange-900/20 to-[#16171D] border-orange-500/30"; }

          return (
            <motion.div
              key={user.wallet}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`relative grid grid-cols-12 gap-2 md:gap-4 items-center p-3 md:p-4 rounded-xl border mb-2 ${rowClass}`}
            >
              <div className="col-span-2 md:col-span-1 flex justify-center text-lg md:text-xl">{rankBadge}</div>
              <div className="col-span-5 md:col-span-4 flex items-center gap-2 overflow-hidden">
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-xs font-bold ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {isMe ? 'ME' : user.wallet[0]}
                </div>
                <div className="flex flex-col truncate">
                    <span className={`font-mono text-xs md:text-sm font-bold truncate ${isMe ? 'text-blue-400' : (index < 3 ? 'text-white' : 'text-gray-400')}`}>
                      {user.wallet.slice(0, 4)}...{user.wallet.slice(-4)}
                    </span>
                    <span className="text-[9px] text-gray-600 md:hidden">业绩: ${volume.toFixed(2)}</span>
                </div>
              </div>
              <div className="hidden md:flex col-span-2 items-center justify-center gap-1">
                <span className="text-green-400 font-bold">{user.referrals_count}</span>
                <span className="text-gray-600 text-xs">人</span>
              </div>
              <div className="col-span-5 md:col-span-2 text-right flex flex-col justify-center items-end">
                  <span className="font-mono font-bold text-yellow-500 text-xs md:text-sm">
                    {earned.toFixed(0)} <span className="text-[9px] opacity-70">MGT</span>
                  </span>
                  <div className="md:hidden mt-1 flex items-center gap-1 bg-gray-800/50 px-1.5 py-0.5 rounded text-[9px] text-gray-400 border border-gray-700/30">
                      <span>👥</span><span className="font-bold text-gray-300">{user.referrals_count}</span>
                  </div>
              </div>
              <div className="col-span-12 md:col-span-3 mt-1 md:mt-0 flex md:justify-end items-center md:border-0 md:pt-0">
                {index === 0 ? (
                  <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full scale-90 origin-right">🔥 遥遥领先</span>
                ) : (
                  <div className="flex items-center gap-1 text-[10px] md:text-xs justify-end w-full">
                    <span className="text-gray-600 hidden md:inline">差</span>
                    <span className="text-pink-500 font-mono font-bold">-${gap.toFixed(0)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* --- 底部固定栏 --- */}
      <div className="shrink-0 h-[60px] bg-[#1a1b23] border-t border-gray-700/50 z-20 flex items-center px-4 justify-between shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        {myData ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center justify-center min-w-[30px]">
                <span className="text-[9px] text-gray-500 uppercase font-bold">Rank</span>
                <span className="text-lg font-black text-blue-400 italic">#{myIndex + 1}</span>
              </div>
              <div className="h-6 w-px bg-gray-700"></div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white">ME</div>
                    <span className="text-xs font-bold text-white tracking-wide">我 ({currentUserWallet?.slice(0,4)})</span>
                </div>
                <span className="text-[10px] text-gray-400">
                    直推 <span className="text-white font-bold">{myData.referrals_count}</span> 人
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">总业绩(USD)</p>
              <p className="text-base font-black text-yellow-400 font-mono">${myData.team_volume?.toFixed(2) || "0.00"}</p>
            </div>
          </>
        ) : (
          <div className="w-full flex items-center justify-between text-gray-400">
            <div className="flex items-center gap-2">
                <span className="text-xl">🐢</span>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-300">尚未进入前50名</span>
                  <span className="text-[10px] opacity-70">加油推广，榜单等你！</span>
                </div>
            </div>
            <div className="text-right opacity-50">
                <p className="text-[10px] text-gray-600">当前账号</p>
                <p className="text-xs font-mono">{currentUserWallet ? currentUserWallet.slice(0,4)+'...' : '未连接'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
