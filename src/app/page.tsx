"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import Leaderboard from "@/components/Leaderboard";
import { supabase } from "@/lib/supabase";
import { getRefFromUrl } from "@/lib/utils";
import PriceChart from "@/components/PriceChart";

// 防止 TS 报错
declare global {
  interface Window {
    Jupiter: any;
  }
}

// 动画配置
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, duration: 0.4 } },
};

// Navbar 组件
const Navbar = () => (
  <motion.header
    className="fixed top-0 left-0 w-full z-50 bg-gray-900/80 backdrop-blur-md shadow-2xl border-b border-white/5"
    initial={{ y: -100 }}
    animate={{ y: 0 }}
    transition={{ delay: 0, duration: 0.5 }}
  >
    <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
      <motion.div 
        className="flex items-center space-x-2 md:space-x-3"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <img 
          src="/pump-logo.png" 
          alt="Pump Logo" 
          className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
        />
        <span className="text-lg md:text-2xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500 drop-shadow-sm">
          MGToken
        </span>
      </motion.div>
      <div className="scale-90 md:scale-100 origin-right">
        <WalletMultiButton style={{ background: "#9333ea", height: "36px", fontSize: "13px", fontWeight: "bold" }} />
      </div>
    </div>
  </motion.header>
);

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(false);
  const { publicKey, connected, signMessage } = useWallet();
  const [inviter, setInviter] = useState<string | null>(null);
  const [myRefs, setMyRefs] = useState(0);
  const hasCheckedRef = useRef(false);
  const bindRef = useRef(false);
  const [pendingReward, setPendingReward] = useState(0);
  const [baseUrl, setBaseUrl] = useState(''); 
  const [teamVolume, setTeamVolume] = useState(0); 
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);

  // ✅ 新增：手动绑定相关状态
  const [isBinding, setIsBinding] = useState(false); // 控制绑定弹窗
  const [manualReferrer, setManualReferrer] = useState(""); // 手动输入的地址

  // 初始化逻辑
  useEffect(() => {
    if (typeof window !== 'undefined') {
        setBaseUrl(window.location.origin);
    }
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    setTimeout(() => setLoading(false), 100);

    const ref = getRefFromUrl();
    if (ref) setInviter(ref);
  }, []);

  // 欢迎弹窗逻辑
  useEffect(() => {
    if (connected) {
      setShowWelcome(true);
      const timer = setTimeout(() => setShowWelcome(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowWelcome(false);
    }
  }, [connected]);

// 自动绑定逻辑
  const bindReferral = useCallback(async () => {
    if (!publicKey || !inviter || !signMessage || bindRef.current) return;
    
    // ✅ 新增：防止自己绑定自己（这会导致数据库错误）
    if (inviter === publicKey.toBase58()) {
        console.log("不能绑定自己为上级，跳过自动绑定");
        return;
    }

    bindRef.current = true;
    
    try {
      // 1. 检查是否已经有上级
      const { data } = await supabase.from("users").select("referrer").eq("wallet", publicKey.toBase58()).maybeSingle();

      // 如果已经有上级了，更新本地状态显示出来，然后直接结束
      if (data?.referrer) {
        setInviter(data.referrer);
        return; 
      }

      // 2. 签名并写入数据库
      const message = new TextEncoder().encode(`Bind referral ${inviter} ${Date.now()}`);
      await signMessage(message);
      
      const { error } = await supabase.from("users").upsert({ 
          wallet: publicKey.toBase58(), 
          referrer: inviter 
      });

      if (error) throw error; // 如果数据库报错，抛出异常

      // ✅✅✅ 修改点：成功弹窗居中 + 高级样式
      toast.success("自动绑定成功！🤝", {
          position: "top-center",
          style: {
              marginTop: "40vh", // 核心：垂直居中
              minWidth: '250px',
              background: 'rgba(17, 24, 39, 0.95)',
              backdropFilter: 'blur(16px)',
              color: '#fff',
              border: '1px solid rgba(34, 197, 94, 0.6)', // 绿色边框
              padding: '20px 30px',
              borderRadius: '24px',
              boxShadow: '0 20px 50px -10px rgba(34, 197, 94, 0.5)',
              fontWeight: 'bold',
              fontSize: '18px',
              textAlign: 'center',
          },
          duration: 3000
      });

    } catch (err) {
      console.error("自动绑定失败详情:", err);
      
      // ✅✅✅ 修改点：失败弹窗居中 + 红色警示样式
      toast.error("自动绑定失败，请重试 ❌", {
          position: "top-center",
          style: {
              marginTop: "40vh",
              minWidth: '250px',
              background: 'rgba(17, 24, 39, 0.95)',
              backdropFilter: 'blur(16px)',
              color: '#fff',
              border: '1px solid rgba(239, 68, 68, 0.6)', // 红色边框
              padding: '20px 30px',
              borderRadius: '24px',
              boxShadow: '0 20px 50px -10px rgba(239, 68, 68, 0.5)', // 红色光晕
              fontWeight: 'bold',
              fontSize: '18px',
              textAlign: 'center',
          },
          duration: 4000
      });
      
      bindRef.current = false; // 允许重试
    }
  }, [publicKey, inviter, signMessage]);
  useEffect(() => {
    if (connected && publicKey) bindReferral();
  }, [connected, publicKey, bindReferral]);

// ✅ 修改后的手动绑定函数：弹窗居中 + 错误提示优化
  const handleManualBind = async () => {
    if (!publicKey || !signMessage) return;
    
    // 1. 校验地址长度
    if (!manualReferrer || manualReferrer.length < 32) {
        toast.error("请输入有效的 Solana 地址", {
            position: "top-center",
            style: {
                marginTop: "40vh",
                background: 'rgba(17, 24, 39, 0.95)',
                color: '#fff',
                border: '1px solid rgba(239, 68, 68, 0.5)', // 红色边框
                padding: '16px 24px',
                borderRadius: '50px',
                boxShadow: '0 10px 30px -10px rgba(239, 68, 68, 0.5)',
                fontWeight: 'bold',
            }
        });
        return;
    }
    
    // 2. 校验是否自绑
    if (manualReferrer === publicKey.toBase58()) {
        toast.error("不能绑定自己为上级 ❌", {
            position: "top-center",
            style: {
                marginTop: "40vh",
                background: 'rgba(17, 24, 39, 0.95)',
                color: '#fff',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                padding: '16px 24px',
                borderRadius: '50px',
                boxShadow: '0 10px 30px -10px rgba(239, 68, 68, 0.5)',
                fontWeight: 'bold',
            }
        });
        return;
    }

    try {
        const message = new TextEncoder().encode(`Manual Bind ${manualReferrer} ${Date.now()}`);
        await signMessage(message);
        
        const { error } = await supabase.from("users").upsert({ 
            wallet: publicKey.toBase58(), 
            referrer: manualReferrer 
        });

        if (error) throw error;

        setInviter(manualReferrer);
        setIsBinding(false);
        
        // ✅ 成功弹窗：居中 + 绿色/粉色风格
        toast.success("绑定上级成功！🎉", {
            position: "top-center",
            style: {
                marginTop: "40vh",
                minWidth: '250px',
                background: 'rgba(17, 24, 39, 0.95)',
                backdropFilter: 'blur(16px)',
                color: '#fff',
                border: '1px solid rgba(168, 85, 247, 0.6)', // 紫色边框
                padding: '20px 30px',
                borderRadius: '24px',
                boxShadow: '0 20px 50px -10px rgba(168, 85, 247, 0.5)',
                fontWeight: 'bold',
                fontSize: '18px',
                textAlign: 'center',
            },
            duration: 3000,
        });

    } catch (err) {
        console.error("手动绑定失败", err);
        
        // ❌ 失败弹窗：居中 + 红色警示风格
        toast.error("绑定失败，请重试 😭", {
            position: "top-center",
            style: {
                marginTop: "40vh",
                minWidth: '250px',
                background: 'rgba(17, 24, 39, 0.95)',
                backdropFilter: 'blur(16px)',
                color: '#fff',
                border: '1px solid rgba(239, 68, 68, 0.6)', // 红色边框
                padding: '20px 30px',
                borderRadius: '24px',
                boxShadow: '0 20px 50px -10px rgba(239, 68, 68, 0.5)', // 红色光晕
                fontWeight: 'bold',
                fontSize: '18px',
                textAlign: 'center',
            },
            duration: 3000,
        });
    }
  };

  // 数据加载逻辑
  useEffect(() => {
    if (!publicKey) {
      setMyRefs(0);
      setPendingReward(0);
      return;
    }
    const loadData = async () => {
      // 加载上级信息 (确保显示准确)
      const { data: userData } = await supabase.from("users").select("referrer").eq("wallet", publicKey.toBase58()).maybeSingle();
      if (userData?.referrer) setInviter(userData.referrer);

      const { count } = await supabase.from("users").select("*", { count: "exact", head: true }).eq("referrer", publicKey.toBase58());
      setMyRefs(count || 0);
      const { data } = await supabase.from("users").select("pending_reward").eq("wallet", publicKey.toBase58()).single();
      setPendingReward(data?.pending_reward || 0);
      setTeamVolume(0); 
    };
    loadData();
  }, [publicKey]);

  // 领奖逻辑
  const claimReward = async () => {
    if (!publicKey) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("领取成功！");
        setPendingReward(0);
      } else {
        toast.error("领取失败: " + (data.message || data));
      }
    } catch (err) {
      toast.error("网络波动，重试领奖~");
    }
    setClaiming(false);
  };
  
  // 唤起 Jupiter 交易弹窗
  const launchJupiter = () => {
    if (window.Jupiter) {
      window.Jupiter.init({
        displayMode: "modal",
        endpoint: "https://mainnet.helius-rpc.com/?api-key=ee54db44-f348-4700-b17d-1bc7f33a605b", // Helius RPC
        strictTokenList: false,
        formProps: {
          fixedOutputMint: true,
          initialOutputMint: "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump", // MGT
          initialInputMint: "So11111111111111111111111111111111111111112", // SOL
        },
        styles: {
            theme: 'dark',
            container: { background: '#1f2937', color: '#fff' },
        },
      });
    } else {
      toast.error("交易插件加载中，请稍后再试...");
    }
  };

  const myLink = publicKey && baseUrl ? `${baseUrl}?ref=${publicKey.toBase58()}` : "";
  const contractAddress = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump"; 

  if (loading) {
    return (
      <div className="min-h-screen grok-starry-bg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={connected ? 'connected' : 'disconnected'}
        className="min-h-screen grok-starry-bg flex flex-col justify-between"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Navbar />

        {/* 悬浮弹窗 */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div
              initial={{ opacity: 0, x: "-50%", y: "-40%" }}
              animate={{ opacity: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, x: "-50%", y: "-40%" }}
              transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 20 }}
              className="fixed top-1/2 left-1/2 z-[60] w-[90%] max-w-sm"
            >
              <div className="bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 border border-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.5)] text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">🎉 连接成功！</h3>
                <p className="text-gray-300 text-sm mb-3">欢迎加入 MGT 军团</p>
                <div className="bg-black/40 rounded-lg p-2 font-mono text-xs text-green-300 break-all border border-white/10">
                  {publicKey?.toBase58()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ✅✅✅ 新增：手动绑定弹窗 ✅✅✅ */}
        <AnimatePresence>
            {isBinding && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-gray-900 border border-purple-500/50 rounded-2xl p-6 w-[90%] max-w-md shadow-2xl relative"
                    >
                        <button 
                            onClick={() => setIsBinding(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                        <h3 className="text-xl font-bold text-purple-400 mb-4">手动绑定上级</h3>
                        <p className="text-sm text-gray-400 mb-4">请输入邀请人的 Solana 钱包地址：</p>
                        
                        <input 
                            type="text" 
                            placeholder="输入地址..." 
                            value={manualReferrer}
                            onChange={(e) => setManualReferrer(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:border-purple-500 focus:outline-none"
                        />
                        
                        <button 
                            onClick={handleManualBind}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl transition-all"
                        >
                            确认绑定
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
          
        {/* 主容器 */}
        <div className="container mx-auto px-4 pt-16 md:pt-20 pb-10 text-center flex-grow"> 
          {!connected ? (
            <motion.div 
              variants={containerVariants} 
              className="max-w-2xl mx-auto mt-12 md:mt-20"
            >
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent leading-tight py-2">
                $MGT 直推军团
              </h1>

              {/* 社交媒体 & CA 复制栏 */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-3 mt-4 px-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contractAddress);
                    toast.success("CA 已复制，去 Jupiter 冲！", {
                      position: "top-center",
                      style: {
                        marginTop: "40vh",
                        minWidth: '260px',
                        background: 'rgba(17, 24, 39, 0.95)',
                        backdropFilter: 'blur(16px)',
                        color: '#fff',
                        border: '1px solid rgba(34, 197, 94, 0.6)',
                        padding: '20px 30px',
                        borderRadius: '24px',
                        boxShadow: '0 20px 50px -10px rgba(34, 197, 94, 0.4)',
                        fontWeight: 'bold',
                        fontSize: '18px',
                        textAlign: 'center',
                      },
                      icon: '💊',
                      duration: 2000,
                    });
                  }}
                  className="flex items-center space-x-2 bg-gray-800/50 hover:bg-gray-800 border border-gray-600 rounded-full px-4 py-1.5 transition-all active:scale-95 group"
                >
                  <span className="text-gray-400 text-xs font-mono">CA:</span>
                  <span className="text-gray-200 text-xs font-mono font-bold group-hover:text-green-400 transition-colors">
                    {`${contractAddress.slice(0, 4)}...pump`}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <div className="flex items-center space-x-2">
                </div>
              </div>

              <p className="text-lg md:text-xl text-gray-300 mt-6 px-4">
                连接钱包，开启 <span className="text-purple-400 font-bold">5%</span> 返现之旅！
              </p>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} className="max-w-5xl mx-auto space-y-6 md:space-y-8">
              
              <div className="mt-6 flex justify-center pb-4">
                <button
                    onClick={launchJupiter}
                    className="relative group cursor-pointer"
                >
                    <div className="absolute -inset-1 bg-gradient-to-r from-green-400 to-blue-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200 animate-pulse"></div>
                    <div className="relative px-8 py-3 bg-black rounded-full leading-none flex items-center space-x-3">
                    <span className="text-2xl">💊</span>
                    <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-400 group-hover:text-white transition-colors">
                        立即购买 $MGT
                    </span>
                    </div>
                </button>
               </div>

              {/* K线图 */}
              <div className="w-full mb-4 md:mb-8 mt-4">
                <PriceChart tokenAddress={contractAddress} />
              </div>

              {/* 第一层：关系卡片 */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 0.8, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="bg-gray-900/60 backdrop-blur-xl rounded-2xl md:rounded-3xl p-5 md:p-8 border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)] relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -z-10"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-center divide-y md:divide-y-0 md:divide-x divide-gray-700/50">
                  
                  {/* ✅✅✅ 上级信息栏 (带手动绑定按钮) ✅✅✅ */}
                  <div className="flex flex-col items-center justify-center p-2">
                    <p className="text-gray-400 text-xs md:text-sm mb-2">我的指挥官</p>
                    
                    {inviter ? (
                        // 如果有上级，显示地址
                        <div className="flex items-center space-x-2 bg-black/30 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-xs md:text-sm font-mono font-bold text-gray-200">
                                {`${inviter.slice(0, 4)}...${inviter.slice(-4)}`}
                            </p>
                        </div>
                    ) : (
                        // 如果没上级，显示“绑定按钮”
                        <button 
                            onClick={() => setIsBinding(true)}
                            className="flex items-center space-x-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 px-4 py-1.5 rounded-full transition-all group"
                        >
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-xs md:text-sm font-bold text-purple-200 group-hover:text-white">
                                绑定上级 +
                            </span>
                        </button>
                    )}
                  </div>

                  {/* 邀请数 */}
                  <div className="flex flex-col items-center justify-center p-2 pt-6 md:pt-2">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">直推人数</p>
                    <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">{myRefs}</p>
                  </div>
                  {/* 复制链接 */}
                  <div className="flex flex-col items-center justify-center p-2 pt-6 md:pt-2 w-full">
                    <p className="text-gray-400 text-xs md:text-sm mb-3">专属招募令</p>
                    <div className="w-full relative">
                      <input type="text" readOnly value={myLink || "连接钱包生成..."} className="w-full bg-black/40 border border-gray-700 text-gray-500 text-xs rounded-lg px-3 py-2 mb-3 outline-none text-center" />
                    </div>
                    <button
                        onClick={() => {
                          navigator.clipboard.writeText(myLink);
                          toast.success("已复制，去推广吧！", {
                            position: "top-center",
                            style: {
                              marginTop: "40vh",
                              minWidth: '260px',
                              background: 'rgba(17, 24, 39, 0.95)',
                              backdropFilter: 'blur(16px)',
                              color: '#fff',
                              border: '1px solid rgba(236, 72, 153, 0.6)',
                              padding: '20px 30px',
                              borderRadius: '24px',
                              boxShadow: '0 20px 50px -10px rgba(236, 72, 153, 0.5)',
                              fontWeight: 'bold',
                              fontSize: '18px',
                              textAlign: 'center',
                            },
                            icon: '🚀', 
                            duration: 2000,
                          });
                        }}
                        disabled={!myLink} 
                        className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-full text-sm font-bold text-white shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
                      >
                        复制链接
                      </button>
                  </div>
                </div>
              </motion.div>

              {/* 第二层：财务数据 */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 1, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
              >
                {/* 团队业绩 */}
                <motion.div variants={containerVariants} className="bg-gray-900/60 backdrop-blur rounded-2xl p-5 md:p-6 border border-blue-500/30 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <p className="text-blue-200 text-sm font-medium">团队总业绩</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">直推交易额</p>
                    </div>
                    <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 text-sm">💰</div>
                  </div>
                  <div className="mt-3 text-left">
                    <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      ${teamVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </motion.div>

                {/* 待领收益 */}
                <motion.div variants={containerVariants} className="bg-gray-900/60 backdrop-blur rounded-2xl p-5 md:p-6 border border-yellow-500/30 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <p className="text-yellow-200 text-sm font-medium">可领取返现</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">5% 交易税分成</p>
                    </div>
                    <div className="p-1.5 bg-yellow-500/10 rounded-lg text-yellow-400 text-sm">🎁</div>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <p className="text-3xl md:text-4xl font-bold text-yellow-400 tracking-tight">
                      {pendingReward.toFixed(4)} <span className="text-sm text-yellow-600">MGT</span>
                    </p>
                    <button
                      onClick={claimReward}
                      disabled={claiming || pendingReward <= 0}
                      className="w-full md:w-auto px-4 py-2 bg-yellow-600/80 active:bg-yellow-700 rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                    >
                      {claiming ? "领取中..." : "一键领取"}
                    </button>
                  </div>
                </motion.div>
              </motion.div> 

              {/* 排行榜 */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 1.2, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="w-full"
              >
                <Leaderboard />
              </motion.div>
            </motion.div>
          )}
        </div>

        <footer className="w-full py-6 text-center text-gray-600 text-xs md:text-sm font-mono border-t border-white/5 bg-black/40 backdrop-blur-sm">
            <div className="flex flex-col items-center justify-center space-y-1">
            <p className="hover:text-gray-400 transition-colors cursor-default">
                MGTLunarLegacy - Decentralized Platform | Built on Sol
            </p>
            <p className="hover:text-gray-400 transition-colors cursor-default">
                © 2025 Solana. All rights reserved.
            </p>
            </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}