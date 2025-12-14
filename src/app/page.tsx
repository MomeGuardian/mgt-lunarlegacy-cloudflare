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
// 🌍 多语言配置字典 (已更新为线性释放文案)
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
    // 👇 修改了这里
    pending_reward: "待释放总额",
    pending_reward_desc: "每日线性释放 0.2%",
    claim_btn: "收取释放",
    claim_loading: "计算释放中...",
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
    // 👇 Modified here
    pending_reward: "Total Locked",
    pending_reward_desc: "Daily Vesting 0.17%",
    claim_btn: "Harvest",
    claim_loading: "Calculating...",
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
  const [baseUrl, setBaseUrl] = useState(''); 
  const [teamVolume, setTeamVolume] = useState(0); 
  
  // ✅ 状态升级：不再使用 pendingReward，改用 lockedReward
  const [lockedReward, setLockedReward] = useState(0); 
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasShownWelcome = useRef(false);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  
  // 用于弹窗显示的本次释放金额
  const [lastReleasedAmount, setLastReleasedAmount] = useState(0); 

  // 状态管理
  const [isBinding, setIsBinding] = useState(false); 
  const [manualReferrer, setManualReferrer] = useState(""); 
  const [showRules, setShowRules] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = translations[lang];

  // ✅ 新增：直推列表弹窗控制
  const [showRefListModal, setShowRefListModal] = useState(false);
  const [refList, setRefList] = useState<string[]>([]); 
  const [loadingRefList, setLoadingRefList] = useState(false);

  // ✅ 新增：排行榜弹窗控制
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);

  // ✅ 新增：上次结算时间
  const [lastVestingTime, setLastVestingTime] = useState<string | null>(null);
  // ✅ 新增：实时计算的“当前可领”金额
  const [liveClaimable, setLiveClaimable] = useState(0);

  // ✅ 新增：点击卡片触发的查询函数
  const handleShowReferrals = async () => {
    if (!publicKey) return;
    
    setLoadingRefList(true);
    setShowRefListModal(true);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet')
        .eq('referrer', publicKey.toBase58())
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setRefList(data.map(user => user.wallet));
      }
    } catch (err) {
      console.error("查询直推失败:", err);
      toast.error("加载列表失败");
    } finally {
      setLoadingRefList(false);
    }
  };

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
  }, [connected, publicKey]); 

  // 自动绑定逻辑
  const bindReferral = useCallback(async () => {
    if (!publicKey || !inviter || !signMessage || bindRef.current) return;
    if (inviter === publicKey.toBase58()) return;

    bindRef.current = true;
    
    try {
      const { data } = await supabase.from("users").select("referrer").eq("wallet", publicKey.toBase58()).maybeSingle();
      
      if (data?.referrer) {
        setInviter(data.referrer);
        return; 
      }

      const messageContent = `Bind referrer ${inviter} to ${publicKey.toBase58()}`;
      const message = new TextEncoder().encode(messageContent);
      const signatureBytes = await signMessage(message);
      const signatureStr = bs58.encode(signatureBytes);

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
      if (!err.message?.includes("User rejected")) {
      }
      bindRef.current = false; 
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

  // ------------------------------------------------------------------
  // ✅ 1. 加载用户数据 (已修改为查询 locked_reward)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (connected && publicKey) {
      const loadData = async () => {
        try {
          const { data: refData } = await supabase
            .from("users")
            .select("referrer")
            .eq("wallet", publicKey.toBase58())
            .maybeSingle();
            
          if (refData?.referrer) setInviter(refData.referrer);

          const { count } = await supabase
            .from("users")
            .select("*", { count: "exact", head: true })
            .eq("referrer", publicKey.toBase58());
          
          setMyRefs(count || 0);

          // C. 获取冻结池和业绩
          const { data: financeData } = await supabase
            .from("users")
            .select("locked_reward, team_volume, last_vesting_time") // 👈 关键修改
            .eq("wallet", publicKey.toBase58())
            .single();
          
          setLockedReward(financeData?.locked_reward || 0);
          setTeamVolume(financeData?.team_volume || 0);
          setLastVestingTime(financeData?.last_vesting_time || null);
          
        } catch (error) {
          console.error("加载数据失败:", error);
        }
      };

      loadData(); 
    } else {
        setMyRefs(0);
        setLockedReward(0);
        setTeamVolume(0);
    }
  }, [publicKey, connected]);

// ------------------------------------------------------------------
  // ✅ 2.useEffect B: 每日 00:00 倒计时检查器
  // ------------------------------------------------------------------
  // 新增一个状态来存倒计时字符串 (放在组件顶部 const 区域)
  const [countDownStr, setCountDownStr] = useState(""); 

  useEffect(() => {
    // 没钱就不算了
    if (!lockedReward || lockedReward <= 0) {
      setLiveClaimable(0);
      return;
    }

    const checkAvailability = () => {
      const now = new Date();
      const lastTime = lastVestingTime ? new Date(lastVestingTime) : new Date(0);

      // --- 关键算法：全部转成“北京时间对象”来比较 ---
      const offset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
      
      const bjNow = new Date(now.getTime() + offset);
      const bjLast = new Date(lastTime.getTime() + offset);

      const todayStr = bjNow.toISOString().split('T')[0];
      const lastDayStr = bjLast.toISOString().split('T')[0];

      // 1. 判断北京日期是否不同
      if (todayStr !== lastDayStr) {
        // ✅ 不是同一天 -> 可以领！
        setLiveClaimable(lockedReward / 14);
        setCountDownStr("✨ 今日额度已释放 ✨");
      } else {
        // ❌ 是同一天 -> 不能领 -> 计算距离北京明天的倒计时
        setLiveClaimable(0); 

        // 计算逻辑：
        // 取“北京现在的这一天”，往后推一天，设为 00:00:00
        const tomorrowMidnightBj = new Date(bjNow); 
        tomorrowMidnightBj.setUTCDate(tomorrowMidnightBj.getUTCDate() + 1);
        tomorrowMidnightBj.setUTCHours(0, 0, 0, 0);

        // 倒计时 = 明天凌晨 - 现在 (都是北京时间，可以直接减)
        const diff = tomorrowMidnightBj.getTime() - bjNow.getTime();
        
        // 格式化倒计时
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setCountDownStr(`下轮释放: ${h}时${m}分${s}秒`);
      }
    };

    checkAvailability(); 
    const interval = setInterval(checkAvailability, 1000);

    return () => clearInterval(interval);
  }, [lockedReward, lastVestingTime]);

  // ------------------------------------------------------------------
  // ✅ 3. 收取释放 (Harvest Function)
  // ------------------------------------------------------------------
  const claimReward = async () => {
    if (!publicKey) return;
    // 如果冻结池都没钱，就别点了
    if (lockedReward <= 0) {
        toast.error("暂无奖励可释放");
        return;
    }

    setClaiming(true);
    const toastId = toast.loading("正在计算并释放奖励...");

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      const data = await res.json();
      
      if (res.ok) {
        // ✅ 成功逻辑：
        // data.released 是后端算出来的本次释放金额
        const releasedVal = data.released || 0;
        setLastReleasedAmount(releasedVal); // 用于弹窗显示
        
        // 更新前端显示的“冻结总额” (减去刚才领走的)
        setLockedReward(prev => Math.max(0, prev - releasedVal));
        
        setShowClaimSuccess(true);
        toast.dismiss(toastId); // 关闭 loading toast

        // 触发撒花特效 🎊
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#eab308', '#a855f7'] 
        });
      } else {
        const errorMessage = data.error || data.message || JSON.stringify(data);
        toast.error(errorMessage, { id: toastId });
      }
    } catch (err) {
      console.error("释放请求错误:", err);
      toast.error("网络连接失败，请稍后重试", { id: toastId });
    }
    setClaiming(false);
  };
  
  // ------------------------------------------------------------------
  // ✅ 4. 辅助变量与加载状态
  // ------------------------------------------------------------------
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

        {/* 🎉 释放成功 史诗级弹窗 🎉 */}
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
                  成功释放!
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  本次释放金额：<br/>
                  <span className="text-2xl font-bold text-yellow-400">{lastReleasedAmount.toFixed(4)} MGT</span>
                  <br/><span className="text-xs text-gray-500 mt-2 block">请等待管理员手动打款</span>
                </p>

                {/* 按钮组 */}
                <div className="flex flex-col gap-3">
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
                            <p>1. <span className="text-white font-bold">绑定关系：</span> 连接钱包后，系统自动绑定邀请关系。</p>
                            <p>2. <span className="text-white font-bold">线性释放：</span> 奖励进入冻结池，每日自动释放 <span className="text-yellow-400 font-bold">0.17%</span>。</p>
                            <p>3. <span className="text-white font-bold">排行榜：</span> 实时更新直推人数和业绩。</p>
                            <p>4. <span className="text-white font-bold">收取释放：</span> 点击“收取释放”按钮结算当前已释放的奖励。</p>
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
                            <p>$MGT (Moon Global Token) 是 Solana 链上首个结合 <span className="text-white font-bold">“强地推 + 线性释放”</span> 的创新 Meme 代币。</p>
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

              {/* 2. 财务数据 (已全面升级为 线性释放 UI) */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 0.6, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
              >
                {/* 💰 直推总业绩卡片 (保持不变) */}
              <motion.div
                onClick={() => setShowLeaderboardModal(true)} 
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.03)" }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer relative overflow-hidden p-6 rounded-2xl border border-gray-800/50 bg-[#16171D]/50 backdrop-blur-sm flex items-center justify-between group hover:border-blue-500/30 transition-all shadow-lg"
              >
              {/* 背景光效 */}
              <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-400 text-sm font-medium">我的直推总业绩</p>
                  <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">USD</span>

                    {/* 🆕 提示标签 (悬停显示) */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 font-bold">
                      查看榜单
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-2">直推交易额 (U本位)</p>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white tracking-tight relative z-10">
                    ${teamVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

                {/* 图标装饰 */}
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <span className="text-2xl">🏆</span>
                </div>
              </motion.div>

              {/* 🎁 每日释放卡片 (00:00 准点版) */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-6 rounded-2xl border border-gray-800/50 bg-[#16171D]/50 backdrop-blur-sm flex items-center justify-between group hover:border-green-500/30 transition-all shadow-lg"
              >
                <div className="flex flex-col gap-3">
                  {/* 第一行：总金库 */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-gray-500 text-xs font-medium">总锁仓 (Locked)</p>
                      <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">
                        14天线性释放
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 opacity-70">
                      <span className="text-lg font-bold text-gray-300 font-mono">
                        {lockedReward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs text-gray-600">MGT</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-gray-800/50"></div>

                  {/* 第二行：今日可领 (带倒计时) */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-bold flex items-center gap-1 ${liveClaimable > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                            {liveClaimable > 0 ? (
                                <>
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                  今日可领 (Available)
                                </>
                            ) : (
                                <>
                                  <span>⏳</span> {countDownStr || "计算中..."}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl md:text-4xl font-black tracking-tight font-mono ${liveClaimable > 0 ? 'text-white' : 'text-gray-500'}`}>
                        {liveClaimable > 0 ? liveClaimable.toFixed(4) : "0.0000"}
                      </span>
                      <span className="text-sm text-gray-600 font-bold">MGT</span>
                    </div>
                  </div>
                </div>

                {/* 按钮 */}
                <div>
                      <button
                      onClick={claimReward}
                      // 没钱的时候禁用按钮
                      disabled={claiming || liveClaimable <= 0}
                      className={`
                        relative overflow-hidden px-5 py-6 rounded-xl font-bold text-sm transition-all shadow-lg flex flex-col items-center justify-center min-w-[110px]
                        ${(claiming || liveClaimable <= 0)
                          ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700"
                          : "bg-gradient-to-br from-green-500 to-emerald-700 hover:scale-105 text-white shadow-green-500/20 border border-green-400/20"
                        }
                      `}
                    >
                      {claiming ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <span className="text-2xl mb-1">Harvest</span>
                          <span className="text-[10px] opacity-80 uppercase tracking-widest">
                            {liveClaimable > 0 ? "一键领取" : "等待释放"}
                          </span>
                        </>
                      )}
                    </button>
                </div>
              </motion.div>
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

                  {/* 👥 直推人数卡片 (已添加点击事件) */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShowReferrals} // 👈 点击触发查询
                    className="bg-[#16171D] p-6 rounded-2xl border border-gray-800/50 hover:border-blue-500/50 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="text-6xl">👥</span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-gray-400 text-sm font-medium">我的直推人数</p>
                        {/* 提示小图标 */}
                      <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded">点击查看</span>
                    </div>

                    <div className="flex items-end gap-2">
                      <h3 className="text-4xl font-black text-white tracking-tight">
                        {myRefs}
                      </h3>
                      <span className="text-gray-500 mb-1.5 font-bold">人</span>
                    </div>
                  </motion.div>

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

          {/* 📜 直推名单弹窗 */}
        <AnimatePresence>
          {showRefListModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowRefListModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()} 
                className="w-full max-w-md bg-[#16171D] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl"
              >
                {/* 标题栏 */}
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-white/5">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    👥 直推伙伴 ({refList.length})
                  </h3>
                  <button onClick={() => setShowRefListModal(false)} className="text-gray-400 hover:text-white transition-colors">
                    ✕
                  </button>
                </div>

                {/* 列表内容区 */}
                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {loadingRefList ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      加载中...
                    </div>
                  ) : refList.length > 0 ? (
                    <div className="space-y-2">
                      {refList.map((wallet, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-gray-800/50 hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                              {index + 1}
                            </div>
                            <span className="font-mono text-gray-300 text-sm">
                              {wallet.slice(0, 6)}...{wallet.slice(-6)}
                            </span>
                          </div>
                          
                          {/* 复制按钮 */}
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(wallet);
                              toast.success("已复制地址");
                            }}
                            className="text-gray-600 hover:text-blue-400 text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-all"
                          >
                            COPY
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      <p className="text-4xl mb-2">🏜️</p>
                      <p>还没有直推伙伴，快去邀请吧！</p>
                    </div>
                  )}
                </div>
                
                {/* 底部按钮 */}
                <div className="p-4 border-t border-gray-800 bg-black/20">
                    <button 
                        onClick={() => setShowRefListModal(false)}
                        className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all"
                    >
                        关闭列表
                    </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 🏆 排行榜弹窗 (复用 Leaderboard 组件) */}
        <AnimatePresence>
          {showLeaderboardModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={() => setShowLeaderboardModal(false)}>
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()} 
                className="w-full max-w-4xl bg-[#16171D] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[85vh]"
              >
                {/* 弹窗头部 */}
                <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    <div>
                        <h3 className="text-lg font-bold text-white">实时推广排行榜</h3>
                        <p className="text-xs text-gray-400">数据实时更新，竞争顶级荣耀</p>
                    </div>
                  </div>
                  <button onClick={() => setShowLeaderboardModal(false)} className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all">
                    ✕
                  </button>
                </div>

                {/* 内容区域 - 放入 Leaderboard 组件 */}
                <div className="flex-1 overflow-hidden bg-[#0b0c10]">
                    {/* 👇 直接复用你之前写好的排行榜组件 */}
                    <Leaderboard currentUserWallet={publicKey?.toBase58()} />
                </div>
                
                {/* 底部关闭栏 */}
                <div className="p-4 border-t border-gray-800 bg-black/40 text-center">
                    <p className="text-xs text-gray-500 mb-2">努力推广，下一个榜一就是你！</p>
                    <button 
                        onClick={() => setShowLeaderboardModal(false)}
                        className="w-full md:w-auto px-12 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all border border-gray-700"
                    >
                        关闭榜单
                    </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </AnimatePresence>
  );
}
