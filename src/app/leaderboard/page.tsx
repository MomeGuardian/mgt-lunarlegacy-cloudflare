"use client";

import { motion } from "framer-motion";
import Leaderboard from "@/components/Leaderboard"; // 确保你之前有这个组件
import { useRouter } from "next/navigation";

export default function LeaderboardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen grok-starry-bg text-white">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#0F1115]/90 backdrop-blur-md border-b border-white/5 h-16 flex items-center px-4">
        <div className="container mx-auto flex items-center justify-between">
          
          {/* 返回按钮 */}
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </div>
            <span className="font-bold text-sm">返回首页</span>
          </button>

          {/* 页面标题 */}
          <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 absolute left-1/2 -translate-x-1/2">
            🏆 实时风云榜
          </h1>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-4 pt-24 pb-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          {/* 顶部装饰卡片 */}
          <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-2xl p-6 mb-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-[40px] -z-10"></div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">推广英雄榜</h2>
            <p className="text-yellow-200/80 text-sm">
              数据实时更新 | 竞争顶级荣耀
            </p>
          </div>

          {/* 排行榜组件容器 */}
          <div className="bg-[#111] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden min-h-[500px]">
            <Leaderboard />
          </div>
        </motion.div>
      </main>
    </div>
  );
}