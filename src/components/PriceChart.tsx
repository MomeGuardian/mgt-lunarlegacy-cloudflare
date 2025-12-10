"use client";

import { FC } from "react";

interface PriceChartProps {
  tokenAddress: string;
  lang: 'zh' | 'en'; // ✅ 新增：接收语言参数
}

const PriceChart: FC<PriceChartProps> = ({ tokenAddress, lang }) => {
  
  // 🌍 内部翻译字典
  const t = {
    zh: {
      title: "实时K线 (MGT/SOL)",
      desc: "查看 K 线、流动性池、最新交易记录",
      ave_btn: "Ave.ai (中国专用 🎗️)",
      dex_btn: "DexScreener (国际通用)"
    },
    en: {
      title: "Live Chart (MGT/SOL)",
      desc: "View Chart, Liquidity Pool, Transactions",
      ave_btn: "Ave.ai (China🎗️)",
      dex_btn: "DexScreener (Global)"
    }
  }[lang];

  // 按钮跳转逻辑
  const openAve = () => window.open(`https://ave.ai/token/${tokenAddress}-solana`, '_blank');
  const openDex = () => window.open(`https://dexscreener.com/solana/${tokenAddress}`, '_blank');

  return (
    <div className="w-full max-w-6xl mx-auto">
      
      {/* 📱 手机端视图 */}
      <div className="block md:hidden">
        <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-purple-500/20 rounded-2xl p-5 shadow-[0_0_30px_-10px_rgba(168,85,247,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 rounded-full blur-[50px] -z-10"></div>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                {/* ✅ 翻译标题 */}
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                  {t.title}
                </h3>
              </div>
              {/* ✅ 翻译副标题 */}
              <p className="text-xs text-gray-500 pl-8">{t.desc}</p>
            </div>

            <button
              onClick={openAve}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#111] hover:bg-[#222] border border-green-500/30 rounded-xl transition-all active:scale-95 group"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></span>
              <span className="font-bold text-green-400">{t.ave_btn} ↗</span>
            </button>

            <button
              onClick={openDex}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#111] hover:bg-[#222] border border-gray-600 rounded-xl transition-all active:scale-95"
            >
              <img src="https://dexscreener.com/favicon.ico" alt="Dex" className="w-4 h-4 opacity-80" />
              <span className="font-bold text-gray-300">{t.dex_btn} ↗</span>
            </button>
          </div>
        </div>
      </div>


      {/* 💻 电脑端视图 */}
      <div className="hidden md:block">
        <div className="bg-[#0a0a0a] border border-purple-500/20 rounded-2xl overflow-hidden shadow-2xl h-[600px] w-full relative">
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-0">
                <span className="animate-pulse">Loading Chart...</span>
            </div>
            <iframe 
                src={`https://dexscreener.com/solana/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`}
                className="w-full h-full relative z-10"
                style={{ border: 0 }}
                title="DexScreener Chart"
            ></iframe>
        </div>
      </div>

    </div>
  );
};

export default PriceChart;