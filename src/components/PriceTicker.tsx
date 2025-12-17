'use client';
import { useState, useEffect } from 'react';

export default function PriceTicker() {
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        // ✅ 这里用的就是你刚才发的那个正确的链接！
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump');
        const data = await res.json();
        
        // DexScreener 返回的数据里，'pairs' 是一个数组
        // 我们取第一个交易对 (通常流动性最好的那个) 的价格
        const usdPrice = parseFloat(data.pairs?.[0]?.priceUsd || '0');
        
        setPrice(usdPrice);
      } catch (e) {
        console.error("价格获取失败", e);
      }
    };

    fetchPrice();
    // 5秒刷新一次，非常流畅且省电
    const timer = setInterval(fetchPrice, 5000); 
    return () => clearInterval(timer);
  }, []);

  // 加载时显示闪烁的 ...
  if (price === null) return <span className="animate-pulse">...</span>;

  return (
    <span className="font-mono text-green-400 font-bold">
      ${price.toFixed(4)}
    </span>
  );
}
