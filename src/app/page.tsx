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
// ✅ 引入 useRouter 用于页面跳转
import { useRouter } from "next/navigation"; 
// ✅✅✅ 新增这一行：在顶部引入 bs58
import bs58 from 'bs58';
// ✅ 新增：引入撒花库
import confetti from 'canvas-confetti';

// ------------------------------------------------------------------
// 🌍 多语言配置字典
// ------------------------------------------------------------------
const translations = {
  zh: {
    connect: "连接钱包",
    more_leaderboard: "实时排行榜",
    more_rules: "直推规则",
    more_intro: "项目介绍",
    lang_switch: "语言 / Language",
    hero_title: "$MGT 直推军团",
    hero_desc: "连接钱包，开启",
    hero_desc_highlight: "5% 返现",
    hero_desc_end: "之旅！",
    ca_copied: "CA 已复制，去 OKX 冲！",
    link_copied: "推广链接已复制！快去分享吧！",
    buy_btn_main: "立即前往 OKX 抢购 $MGT",
    buy_btn_sub: "USDT / SOL 双通道极速兑换",
    my_commander: "我的指挥官",
    bind_btn: "绑定上级 +",
    my_referrals: "我的直推人数",
    referral_link: "专属招募链接",
    copy_link: "复制链接",
    team_volume: "直推总业绩",
    team_volume_desc: "直推交易额",
    pending_reward: "可领取返现",
    pending_reward_desc: "5% 交易税分成",
    claim_btn: "一键领取",
    claim_loading: "领取中...",
    chart_title: "实时走势",
    manual_bind_title: "手动绑定上级",
    manual_bind_placeholder: "输入地址...",
    confirm_bind: "确认绑定",
    success_bind: "自动绑定成功！🤝",
    success_manual_bind: "绑定上级成功！🎉",
    success_connect: "连接成功",
    addr_copied: "地址已复制到剪贴板 ✅",
    footer_built: "Decentralized Platform | Built on Sol",
    footer_rights: "© 2025 Solana. All rights reserved."
  },
  en: {
    connect: "Connect",
    more_leaderboard: "Leaderboard",
    more_rules: "Rules",
    more_intro: "Introduction",
    lang_switch: "Language / 语言",
    hero_title: "$MGT Legion",
    hero_desc: "Connect wallet to start ",
    hero_desc_highlight: "5% Cashback",
    hero_desc_end: " journey!",
    ca_copied: "CA Copied! Let's go to OKX!",
    link_copied: "Referral link copied! Share it now!",
    buy_btn_main: "Buy $MGT on OKX Now",
    buy_btn_sub: "Fast Swap with USDT / SOL",
    my_commander: "My Commander",
    bind_btn: "Bind Referrer +",
    my_referrals: "My Referrals",
    referral_link: "Referral Link",
    copy_link: "Copy Link",
    team_volume: "Direct Volume",
    team_volume_desc: "Total Trading Vol",
    pending_reward: "Claimable",
    pending_reward_desc: "5% Tax Share",
    claim_btn: "Claim",
    claim_loading: "Claiming...",
    chart_title: "Live Chart",
    manual_bind_title: "Bind Referrer Manually",
    manual_bind_placeholder: "Enter address...",
    confirm_bind: "Confirm Bind",
    success_bind: "Auto bind successful! 🤝",
    success_manual_bind: "Bind successful! 🎉",
    success_connect: "Connected Successfully",
    addr_copied: "Address copied to clipboard ✅",
    footer_built: "Decentralized Platform | Built on Sol",
    footer_rights: "© 2025 Solana. All rights reserved."
  }
};

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

// ✅ Navbar 组件
const Navbar = ({ 
    onOpenRules, onOpenIntro, lang, setLang 
}: { 
    onOpenRules: () => void; 
    onOpenIntro: () => void;
    lang: 'zh' | 'en';
    setLang: (l: 'zh' | 'en') => void;
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const t = translations[lang];
  const { connected, wallet } = useWallet();
  // ✅ 引入 router
  const router = useRouter();

  return (
    <motion.header
      className="fixed top-0 left-0 w-full z-50 bg-gray-900/95 md:bg-gray-900/80 md:backdrop-blur-md shadow-2xl border-b border-white/5"
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

        <div className="flex items-center gap-2">
          
          <div id="mini-wallet-wrapper" className="origin-right relative">
            <WalletMultiButton style={{ padding: 0, minWidth: 0 }}>
                <div className="relative flex items-center justify-center w-full h-full">
                    {connected && wallet ? (
                        <img 
                            src={wallet.adapter.icon} 
                            alt={wallet.adapter.name} 
                            className="w-6 h-6 rounded-full object-cover custom-wallet-logo" 
                        />
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-300">
                           <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clipRule="evenodd" />
                        </svg>
                    )}
                    {connected && (
                        <span className="absolute top-[-2px] right-[-2px] w-2.5 h-2.5 bg-green-500 border-2 border-gray-900 rounded-full z-10"></span>
                    )}
                </div>
            </WalletMultiButton>
          </div>

          <div className="relative">
            <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center justify-center w-8 h-8 bg-gray-800 border border-gray-600 rounded-full hover:bg-gray-700 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 top-10 w-48 bg-[#1a1b23] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-[100]"
                    >
                        <div className="flex flex-col py-1">
                            {/* ✅ 修改：点击跳转到新页面 */}
                            <button 
                                onClick={() => { setIsMenuOpen(false); router.push('/leaderboard'); }}
                                className="px-4 py-3 text-left text-xs text-gray-300 hover:bg-gray-700/50 hover:text-white flex items-center gap-2"
                            >
                                <span>🏆</span> {t.more_leaderboard}
                            </button>
                            <button 
                                onClick={() => { setIsMenuOpen(false); onOpenRules(); }}
                                className="px-4 py-3 text-left text-xs text-gray-300 hover:bg-gray-700/50 hover:text-white flex items-center gap-2"
                            >
                                <span>📜</span> {t.more_rules}
                            </button>
                            <button 
                                onClick={() => { setIsMenuOpen(false); onOpenIntro(); }}
                                className="px-4 py-3 text-left text-xs text-gray-300 hover:bg-gray-700/50 hover:text-white flex items-center gap-2"
                            >
                                <span>ℹ️</span> {t.more_intro}
                            </button>
                            <div className="h-[1px] bg-gray-800 mx-2 my-1"></div>
                            <button onClick={() => { setLang(lang === 'zh' ? 'en' : 'zh'); setIsMenuOpen(false); }} className="px-4 py-3 text-left text-xs font-bold text-purple-400 hover:bg-gray-700/50 hover:text-purple-300 flex items-center gap-2"><span>🌐</span> {lang === 'zh' ? '切换为 English' : 'Switch to 中文'}</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

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
  const hasShownWelcome = useRef(false);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [lastSignature, setLastSignature] = useState(""); // 存储交易哈希

  // 状态管理 (移除了 showLeaderboard)
  const [isBinding, setIsBinding] = useState(false); 
  const [manualReferrer, setManualReferrer] = useState(""); 
  const [showRules, setShowRules] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = translations[lang];

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

// 🌟 核心逻辑：自动登录 + 欢迎弹窗
  useEffect(() => {
    const STORAGE_KEY = "mgt_has_shown_welcome";

    if (connected && publicKey) {
      // 🚀 1. 触发后端自动注册 (静默执行)
      const loginUser = async () => {
        try {
          await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wallet: publicKey.toBase58() })
          });
          console.log("✅ 用户自动注册成功");
        } catch (err) {
          console.error("❌ 自动注册失败:", err);
        }
      };
      loginUser();

      // 🎉 2. 处理欢迎弹窗 (仅首次)
      const hasShown = localStorage.getItem(STORAGE_KEY);
      if (!hasShown) {
        setShowWelcome(true);
        localStorage.setItem(STORAGE_KEY, "true");
        const timer = setTimeout(() => setShowWelcome(false), 3000);
        return () => clearTimeout(timer);
      }
    } else {
      setShowWelcome(false);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [connected, publicKey]); // 依赖项加上 publicKey，确保地址拿到了才发请求

// 自动绑定逻辑
  const bindReferral = useCallback(async () => {
    if (!publicKey || !inviter || !signMessage || bindRef.current) return;
    if (inviter === publicKey.toBase58()) return;

    bindRef.current = true;
    
    try {
      // 1. 检查是否已绑定
      const { data } = await supabase.from("users").select("referrer").eq("wallet", publicKey.toBase58()).maybeSingle();
      
      if (data?.referrer) {
        setInviter(data.referrer);
        return; 
      }

      // 2. 构造签名消息
      const messageContent = `Bind referrer ${inviter} to ${publicKey.toBase58()}`;
      const message = new TextEncoder().encode(messageContent);
      
      // 3. 签名
      const signatureBytes = await signMessage(message);
      
      // 4. 编码签名
      const signatureStr = bs58.encode(signatureBytes);

      // 5. 发送请求
      const res = await fetch('/api/referral/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          referrer: inviter,
          message: messageContent,
          signature: signatureStr
        })
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error);

      // 6. 成功提示
      toast.success(t.success_bind, {
          position: "top-center",
          style: {
              marginTop: "40vh",
              minWidth: '250px',
              background: 'rgba(17, 24, 39, 0.95)',
              backdropFilter: 'blur(16px)',
              color: '#fff',
              border: '1px solid rgba(34, 197, 94, 0.6)', 
              padding: '20px 30px',
              borderRadius: '24px',
              fontWeight: 'bold',
          },
      });

    } catch (err: any) {
      console.error("自动绑定失败:", err);
      // 如果是用户拒绝签名，不要报红错
      if (!err.message?.includes("User rejected")) {
          // toast.error("绑定失败: " + err.message); 
      }
      bindRef.current = false; // 允许重试
    }
  }, [publicKey, inviter, signMessage, t]);

  useEffect(() => {
    if (connected && publicKey) bindReferral();
  }, [connected, publicKey, bindReferral]);

// 手动绑定逻辑
  const handleManualBind = async () => {
    if (!publicKey || !signMessage) return;
    if (!manualReferrer || manualReferrer.length < 32) {
        toast.error("Invalid Address");
        return;
    }
    if (manualReferrer === publicKey.toBase58()) {
        toast.error("Can't bind self");
        return;
    }

    try {
        const messageContent = `Bind referrer ${manualReferrer} to ${publicKey.toBase58()}`;
        const message = new TextEncoder().encode(messageContent);
        
        const signatureBytes = await signMessage(message);
        
        // ❌ 删除这行: const bs58 = require('bs58');
        // ✅ 直接使用顶部的 bs58
        const signatureStr = bs58.encode(signatureBytes);

        const res = await fetch('/api/referral/bind', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                wallet: publicKey.toBase58(),
                referrer: manualReferrer,
                message: messageContent,
                signature: signatureStr
            })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error);

        setInviter(manualReferrer);
        setIsBinding(false);
        toast.success(t.success_manual_bind, {
            position: "top-center",
            style: {
                marginTop: "40vh",
                background: 'rgba(17, 24, 39, 0.95)',
                color: '#fff',
                border: '1px solid rgba(168, 85, 247, 0.6)',
                padding: '20px 30px',
                borderRadius: '24px',
                fontWeight: 'bold',
            }
        });
    } catch (err: any) {
        console.error("手动绑定失败", err);
        toast.error(err.message || "Bind Failed");
    }
  };

// 1. 加载用户数据 (修复版：解决变量重名冲突)
  useEffect(() => {
    if (connected && publicKey) {
      const loadData = async () => {
        try {
          // A. 获取上级
          const { data: refData } = await supabase // 👈 改名 refData，防止冲突
            .from("users")
            .select("referrer")
            .eq("wallet", publicKey.toBase58())
            .maybeSingle();
            
          if (refData?.referrer) setInviter(refData.referrer);

          // B. 获取直推人数
          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("referrer", publicKey.toBase58());
          setMyRefs(count || 0);

          // C. 获取收益和业绩 (核心修改：一次查询两个字段)
          const { data: financeData } = await supabase // 👈 改名 financeData，彻底解决报错
            .from("users")
            .select("pending_reward, team_volume") 
            .eq("wallet", publicKey.toBase58())
            .single();
          
          setPendingReward(financeData?.pending_reward || 0);
          setTeamVolume(financeData?.team_volume || 0); 
          
        } catch (error) {
          console.error("加载数据失败:", error);
        }
      };
      loadData();
    } else {
        // 未连接时清空
        setMyRefs(0);
        setPendingReward(0);
        setTeamVolume(0);
    }
  }, [publicKey, connected]);


  // 2. ⚡️ 实时监听数据变化 (Realtime Listener)
  useEffect(() => {
    if (!connected || !publicKey) return;

    console.log("正在建立实时监听通道...");

    const channel = supabase
      .channel('realtime_users')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `wallet=eq.${publicKey.toBase58()}` // 只监听自己
        },
        (payload) => {
          const newUser = payload.new as any;
          if (newUser) {
            console.log("⚡️ 数据实时更新:", newUser);
            
            // 实时更新前端状态
            setPendingReward(newUser.pending_reward || 0);
            setTeamVolume(newUser.team_volume || 0);
            
            // 只有当业绩真的增加时才弹窗 (防止普通更新也弹窗)
            // 这里简单处理，只要有推送到更新就提示
            toast("🚀 团队业绩刷新！", {
                icon: '💰',
                style: {
                    background: '#16171D',
                    color: '#fff',
                    border: '1px solid #22c55e'
                }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connected, publicKey]);

          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("referrer", publicKey.toBase58());
          setMyRefs(count || 0);

          const { data } = await supabase
            .from("users")
            .select("pending_reward")
            .eq("wallet", publicKey.toBase58())
            .single();
          setPendingReward(data?.pending_reward || 0);
          setTeamVolume(0); 
        } catch (error) {
          console.error("加载数据失败:", error);
        }
      };
      loadData();
    } else {
        setMyRefs(0);
        setPendingReward(0);
    }
  }, [publicKey, connected]);

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
        // ✅ 成功逻辑升级：
        // 1. 清空余额显示
        setPendingReward(0);
        // 2. 记录哈希
        setLastSignature(data.signature);
        // 3. 打开漂亮弹窗
        setShowClaimSuccess(true);
        // 4. 触发撒花特效 🎊
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#eab308', '#a855f7'] // 绿色、金色、紫色
        });
      } else {
        const errorMessage = data.error || data.message || JSON.stringify(data);
        toast.error("提现失败: " + errorMessage);
      }
    } catch (err) {
      console.error("提现网络错误:", err);
      toast.error("网络连接失败，请稍后重试");
    }
    setClaiming(false);
  };
  
  const myLink = publicKey && baseUrl ? `${baseUrl}?ref=${publicKey.toBase58()}` : "";
  const contractAddress = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump"; 

  const openOkxDex = () => {
    const usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    const tokenMint = "59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump";
    const url = `https://www.okx.com/zh-hans/web3/dex-swap?inputChain=501&inputCurrency=${usdtMint}&outputChain=501&outputCurrency=${tokenMint}`;
    window.open(url, '_blank');
  };

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
        <Navbar 
            // ❌ 移除了 onOpenLeaderboard，因为现在是跳转页面
            onOpenRules={() => setShowRules(true)}
            onOpenIntro={() => setShowIntro(true)}
            lang={lang}
            setLang={setLang}
        />

        {/* 🌟 连接成功弹窗 */}
        <AnimatePresence>
          {showWelcome && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed top-28 left-1/2 -translate-x-1/2 z-[100] w-auto"
            >
              <div className="relative flex flex-col items-center justify-center gap-4 bg-[#0F1115]/95 backdrop-blur-2xl border border-white/10 p-6 rounded-[24px] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] overflow-hidden min-w-[280px]">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent"></div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                    <span className="text-2xl animate-[bounce_1s_infinite]">🎉</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-widest drop-shadow-md">
                    {t.success_connect}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    if(publicKey) {
                        navigator.clipboard.writeText(publicKey.toBase58());
                        toast.success(t.addr_copied);
                    }
                  }}
                  className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/5 px-4 py-2 rounded-full transition-all group active:scale-95 w-full justify-center"
                >
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </div>
                  <span className="text-gray-400 font-mono text-sm font-bold">
                    {publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : ''}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🎉 提现成功 史诗级弹窗 🎉 */}
        <AnimatePresence>
          {showClaimSuccess && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.5, rotateX: 90 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                exit={{ opacity: 0, scale: 0.5, rotateX: -90 }}
                transition={{ type: "spring", damping: 15 }}
                className="relative w-full max-w-sm bg-[#16171D] border border-green-500/50 rounded-3xl p-8 text-center shadow-[0_0_50px_-10px_rgba(34,197,94,0.4)] overflow-hidden"
              >
                {/* 背景光效 */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/20 rounded-full blur-[60px] -z-10"></div>
                
                {/* 成功图标 */}
                <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20">
                    <span className="text-4xl animate-bounce">💸</span>
                </div>

                <h3 className="text-2xl font-black text-white mb-2 tracking-wide">
                  提现成功!
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  收益已发送至您的钱包<br/>请查收 $MGT
                </p>

                {/* 按钮组 */}
                <div className="flex flex-col gap-3">
                    {/* 查看浏览器按钮 */}
                    <a 
                      href={`https://solscan.io/tx/${lastSignature}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full py-3 bg-[#111] hover:bg-[#222] border border-gray-700 hover:border-green-500/50 rounded-xl text-green-400 font-bold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <span>🔍 查看链上记录</span>
                    </a>

                    {/* 关闭按钮 */}
                    <button
                      onClick={() => setShowClaimSuccess(false)}
                      className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-green-900/20 active:scale-95 transition-all"
                    >
                      太棒了 (Close)
                    </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 🔗 绑定弹窗 */}
        <AnimatePresence>
            {isBinding && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                >
                    <motion.div 
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-gray-900 border border-purple-500/50 rounded-2xl p-6 w-[90%] max-w-md shadow-2xl relative"
                    >
                        <button onClick={() => setIsBinding(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                        <h3 className="text-xl font-bold text-purple-400 mb-4">{t.manual_bind_title}</h3>
                        <input 
                            type="text" placeholder={t.manual_bind_placeholder} 
                            value={manualReferrer}
                            onChange={(e) => setManualReferrer(e.target.value)}
                            className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:border-purple-500 focus:outline-none"
                        />
                        <button onClick={handleManualBind} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl transition-all">
                            {t.confirm_bind}
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* ❌ 移除了原有的排行榜弹窗代码 */}

        {/* 📜 规则弹窗 */}
        <AnimatePresence>
            {showRules && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full max-w-md bg-[#111] border border-blue-500/30 rounded-2xl shadow-2xl p-6 relative"
                    >
                        <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                        <h3 className="text-xl font-bold text-blue-400 mb-4">📜 {t.more_rules}</h3>
                        <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
                            <p>1. <span className="text-white font-bold">绑定关系：</span> 连接钱包后，系统自动绑定邀请关系，或手动输入地址绑定。</p>
                            <p>2. <span className="text-white font-bold">返现机制：</span> 您的下级每次产生交易，您将自动获得交易税的 <span className="text-yellow-400 font-bold">5%</span> 返现。</p>
                            <p>3. <span className="text-white font-bold">排行榜：</span> 排行榜根据“直推人数”和“团队总业绩”实时更新。</p>
                            <p>4. <span className="text-white font-bold">领取奖励：</span> 返现金额累计在“待领收益”中，您可以随时一键提现。</p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* ℹ️ 介绍弹窗 */}
        <AnimatePresence>
            {showIntro && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="w-full max-w-md bg-[#111] border border-purple-500/30 rounded-2xl shadow-2xl p-6 relative"
                    >
                        <button onClick={() => setShowIntro(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">✕</button>
                        <h3 className="text-xl font-bold text-purple-400 mb-4">ℹ️ About $MGT</h3>
                        <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
                            <p>$MGT (Moon Global Token) 是 Solana 链上首个结合 <span className="text-white font-bold">“强地推 + 自动分账”</span> 的创新 Meme 代币。</p>
                            <div className="mt-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
                                <p className="text-xs text-gray-500 mb-1">Contract Address (CA):</p>
                                <p className="text-xs text-green-400 font-mono break-all">{contractAddress}</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
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
                {t.hero_title}
              </h1>

              {/* 社交媒体 & CA 复制栏 */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-3 mt-4 px-4">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(contractAddress);
                    toast.success(t.ca_copied, {
                      position: "top-center",
                      duration: 2000,
                      icon: '💊',
                      style: {
                        marginTop: "40vh", 
                        minWidth: '260px',
                        background: 'rgba(17, 24, 39, 0.95)',
                        backdropFilter: 'blur(16px)',
                        color: '#fff',
                        border: '1px solid rgba(34, 197, 94, 0.6)',
                        padding: '20px 30px',
                        borderRadius: '24px',
                        boxShadow: '0 0 50px -10px rgba(34, 197, 94, 0.5)',
                        fontWeight: 'bold',
                        fontSize: '18px',
                        textAlign: 'center',
                      },
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
              </div>

              <p className="text-lg md:text-xl text-gray-300 mt-6 px-4">
                {t.hero_desc} <span className="text-purple-400 font-bold">{t.hero_desc_highlight}</span> {t.hero_desc_end}
              </p>
            </motion.div>
          ) : (
            <motion.div variants={containerVariants} className="max-w-5xl mx-auto space-y-6 md:space-y-8">
              
              {/* 1. 购买按钮 */}
              <div className="mt-4 md:mt-6 flex justify-center pb-2">
                <button
                  onClick={openOkxDex}
                  className="w-full max-w-md relative group cursor-pointer overflow-hidden rounded-2xl"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 animate-gradient-x"></div>
                    <div className="absolute inset-0 bg-white/20 group-hover:bg-white/10 transition-colors"></div>
                    <div className="relative px-6 py-4 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl animate-bounce">💊</span>
                            <span className="text-xl md:text-2xl font-black text-white tracking-wide uppercase drop-shadow-md">
                                {t.buy_btn_main}
                            </span>
                        </div>
                        <span className="text-green-100 text-xs md:text-sm font-medium mt-1 bg-black/20 px-3 py-0.5 rounded-full">
                            {t.buy_btn_sub}
                        </span>
                    </div>
                </button>
              </div>

              {/* 2. 财务数据 */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 0.6, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
              >
                {/* 团队业绩 */}
                <div className="bg-gray-900/95 md:bg-gray-900/60 md:backdrop-blur rounded-2xl p-5 md:p-6 border border-blue-500/30 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -z-10"></div>
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <p className="text-blue-200 text-sm font-medium">{t.team_volume}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{t.team_volume_desc}</p>
                    </div>
                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 text-lg">💰</div>
                  </div>
                  <div className="mt-3 text-left">
                    <p className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                      ${teamVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {/* 待领收益 */}
                <div className="bg-gray-900/95 md:bg-gray-900/60 md:backdrop-blur rounded-2xl p-5 md:p-6 border border-yellow-500/30 relative overflow-hidden shadow-lg">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl -z-10"></div>
                  <div className="flex justify-between items-start">
                    <div className="text-left">
                      <p className="text-yellow-200 text-sm font-medium">{t.pending_reward}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{t.pending_reward_desc}</p>
                    </div>
                    <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400 text-lg">🎁</div>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <p className="text-3xl md:text-4xl font-bold text-yellow-400 tracking-tight">
                      {pendingReward.toFixed(4)} <span className="text-sm text-yellow-600">MGT</span>
                    </p>
                    <button
                      onClick={claimReward}
                      disabled={claiming || pendingReward <= 0}
                      className="w-full md:w-auto px-5 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 active:scale-95 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                      {claiming ? t.claim_loading : t.claim_btn}
                    </button>
                  </div>
                </div>
              </motion.div> 

              {/* 3. K线图 */}
              <div className="w-full mt-2">
                <PriceChart tokenAddress={contractAddress} lang={lang} />
              </div>

              {/* 4. 关系卡片 */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 0.8, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="bg-gray-900/95 md:bg-gray-900/60 md:backdrop-blur-xl border border-purple-500/30 shadow-none md:shadow-[0_0_20px_rgba(168,85,247,0.1)] rounded-2xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-center divide-y md:divide-y-0 md:divide-x divide-gray-700/50">
                  <div className="flex flex-col items-center justify-center p-4">
                    <p className="text-gray-400 text-xs md:text-sm mb-2">{t.my_commander}</p>
                    {inviter ? (
                        <div className="flex items-center space-x-2 bg-black/30 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-xs md:text-sm font-mono font-bold text-gray-200">
                                {`${inviter.slice(0, 4)}...${inviter.slice(-4)}`}
                            </p>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsBinding(true)}
                            className="flex items-center space-x-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 px-4 py-1.5 rounded-full transition-all group"
                        >
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-xs md:text-sm font-bold text-purple-200 group-hover:text-white">
                                {t.bind_btn}
                            </span>
                        </button>
                    )}
                  </div>
                  <div className="flex flex-col items-center justify-center p-4">
                    <p className="text-gray-400 text-xs md:text-sm mb-1">{t.my_referrals}</p>
                    <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">{myRefs}</p>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 w-full">
                    <p className="text-gray-400 text-xs md:text-sm mb-3">{t.referral_link}</p>
                    <button
                        onClick={() => {
                          const shareText = `${myLink}`;
                          navigator.clipboard.writeText(shareText);
                          toast.success(t.link_copied, {
                            position: "top-center",
                            duration: 2000,
                            icon: '🚀',
                            style: {
                              marginTop: "40vh",
                              minWidth: '280px',
                              background: 'rgba(17, 24, 39, 0.95)',
                              backdropFilter: 'blur(16px)',
                              color: '#fff',
                              border: '1px solid rgba(236, 72, 153, 0.6)',
                              padding: '20px 30px',
                              borderRadius: '24px',
                              boxShadow: '0 0 50px -10px rgba(236, 72, 153, 0.5)',
                              fontWeight: 'bold',
                              fontSize: '18px',
                              textAlign: 'center',
                            },
                          });
                        }}
                        disabled={!myLink} 
                        className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-full text-sm font-bold text-white shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
                      >
                        {t.copy_link}
                      </button>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          )}
        </div>

        {/* Footer */}
        <footer className="w-full py-6 text-center text-gray-600 text-xs md:text-sm font-mono border-t border-white/5 bg-black/40 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center justify-center space-y-1">
            <p className="hover:text-gray-400 transition-colors cursor-default">
                MGTLunarLegacy - {t.footer_built}
            </p>
            <p className="hover:text-gray-400 transition-colors cursor-default">
                {t.footer_rights}
            </p>
            </div>
        </footer>

      </motion.div>
    </AnimatePresence>
  );
}
