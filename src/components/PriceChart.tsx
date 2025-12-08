"use client";

import { motion } from "framer-motion";

interface PriceChartProps {
tokenAddress: string; 
}

export default function PriceChart({ tokenAddress }: PriceChartProps) {
return (
    <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay: 0.4 }}
    className="w-full relative group"
    >
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gray-900/60 backdrop-blur-md shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
        
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold flex items-center gap-2">
            <span>📊</span>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
            实时走势 (MGT/SOL)
            </span>
        </h3>

        <a 
            href={`https://ave.ai/token/${tokenAddress}-solana?from=Default`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 rounded-lg transition-all text-xs font-bold text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.2)] hover:shadow-[0_0_15px_rgba(74,222,128,0.4)]"
        >
            <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Ave.ai (China🎗️) ↗
        </a>
        </div>

        <div className="w-full h-[350px] md:h-[600px] relative bg-gray-900">
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm -z-10">
                图表加载中... (如长时间未显示，请点击右上角 Ave.ai)
            </div>
            
            <iframe 
            src={`https://dexscreener.com/solana/${tokenAddress}?embed=1&theme=dark&trades=0&info=0`}
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            title="MGT Price Chart"
            ></iframe>
        </div>
    </div>

    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 -z-10"></div>
    </motion.div>
);
}