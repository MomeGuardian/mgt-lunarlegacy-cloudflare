"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface LeaderboardItem {
  rank: number;
  wallet: string;
  avatar: string;
  referrals: number;
  reward: number;
  gap: number;
  isPlaceholder?: boolean; // 新增：标记是否为占位数据
}

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch("/api/leaderboard");
        const realData: LeaderboardItem[] = await res.json();
        
        // --- 核心逻辑：填充空位 ---
        const MIN_ROWS = 10; // 最少显示 10 行
        const filledData = [...realData];

        // 如果真实数据不足 10 条，循环填充占位符
        if (filledData.length < MIN_ROWS) {
          const rowsToAdd = MIN_ROWS - filledData.length;
          for (let i = 0; i < rowsToAdd; i++) {
            filledData.push({
              rank: realData.length + i + 1,
              wallet: "虚位以待", // 显示文案
              avatar: `https://api.dicebear.com/9.x/glass/svg?seed=placeholder${i}`, // 随机灰色头像
              referrals: 0,
              reward: 0,
              gap: 0,
              isPlaceholder: true, // 标记为占位
            });
          }
        }
        
        setLeaderboard(filledData);
      } catch (error) {
        console.error("Failed to fetch leaderboard", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p className="text-center text-gray-500 animate-pulse mt-10">正在加载星际榜单...</p>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.2 }} // 保持页面入场的延迟节奏
      className="bg-gray-900/60 backdrop-blur-md rounded-3xl p-8 border border-gray-800 shadow-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-lg">
          实时排行榜
        </h2>
        <span className="text-xs font-mono text-gray-500 border border-gray-700 px-3 py-1 rounded-full">
          TOP 10 军团长
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-separate border-spacing-y-3">
          <thead className="text-xs uppercase text-gray-500 tracking-wider font-mono">
            <tr>
              <th className="px-4 py-2 text-center">排名</th>
              <th className="px-4 py-2">用户</th>
              <th className="px-4 py-2 text-center">邀请人数</th>
              <th className="px-4 py-2 text-center">返现金额</th>
              <th className="px-4 py-2 text-center">状态</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((item, index) => {
              // 样式逻辑：如果是占位符，显示为半透明灰色；如果是真实数据，显示高亮
              const isReal = !item.isPlaceholder;
              
              return (
                <tr 
                  key={index} // 使用 index 作为 key，因为占位符的 wallet 可能重复
                  className={`transition-all duration-300 rounded-xl group ${
                    isReal 
                      ? "bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700" 
                      : "bg-gray-900/20 border border-dashed border-gray-800 opacity-60" // 占位符样式：虚线框、低透明度
                  }`}
                >
                  {/* 1. 排名列 */}
                  <td className="px-4 py-4 font-black text-center text-lg rounded-l-xl">
                    {isReal && index === 0 ? '🥇' : 
                    isReal && index === 1 ? '🥈' : 
                    isReal && index === 2 ? '🥉' : 
                    <span className={isReal ? "text-blue-500" : "text-gray-700"}>{item.rank}</span>}
                  </td>

                  {/* 2. 用户列 */}
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={item.avatar} 
                        alt="Avatar" 
                        className={`w-10 h-10 rounded-full ring-2 ${isReal ? "ring-blue-500/50" : "ring-gray-700 grayscale"}`} 
                      />
                      <span className={`font-mono text-sm ${isReal ? "text-gray-200" : "text-gray-600 italic"}`}>
                        {isReal ? `${item.wallet.slice(0, 6)}...${item.wallet.slice(-4)}` : "等待加入..."}
                      </span>
                    </div>
                  </td>

                  {/* 3. 邀请数列 */}
                  <td className={`px-4 py-4 text-center font-bold ${isReal ? "text-green-400" : "text-gray-700"}`}>
                    {isReal ? item.referrals : "-"}
                  </td>

                  {/* 4. 返现金额列 */}
                  <td className={`px-4 py-4 text-center font-mono ${isReal ? "text-purple-300" : "text-gray-700"}`}>
                    {isReal ? `${item.reward.toFixed(2)} MGT` : "-"}
                  </td>

                  {/* 5. 状态/差距列 */}
                  <td className="px-4 py-4 text-center rounded-r-xl">
                    {isReal ? (
                      <span className="text-yellow-500 text-xs font-bold">
                        {index === 0 ? "👑 领跑" : `距上名差 ${item.gap}`}
                      </span>
                    ) : (
                      <span className="text-gray-700 text-xs border border-gray-800 px-2 py-1 rounded">
                        虚位以待
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}