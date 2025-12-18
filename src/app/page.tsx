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
import { useRouter } from "next/navigation"; 
import bs58 from 'bs58';
import confetti from 'canvas-confetti';
import PriceTicker from '@/components/PriceTicker';
import dynamic from 'next/dynamic';

const translations = {
  zh: {
    connect: "连接钱包",
    more_leaderboard: "实时排行榜",
    more_rules: "晋升法则",
    more_intro: "MGT介绍",
    lang_switch: "语言 / Language",
    hero_title: "$MGT 直推军团",
    hero_desc: "连接钱包，开启",
    hero_desc_highlight: "5% 返现",
    hero_desc_end: "之旅！",
    ca_copied: "CA 已复制，去 OKX 冲！",
    link_copied: "推广链接已复制！快去分享吧！",
    buy_btn_main: "立即前往 OKX 抢购 $MGT",
    buy_btn_sub: "USDT / SOL 双通道极速兑换",
    my_Leader: "我的指挥官",
    bind_btn: "绑定上级 +",
    referral_link: "专属招募链接",
    copy_link: "复制链接",

    team_volume: "我的直推总业绩",
    team_volume_desc: "直推总交易额 (USDT)",
    check_leaderboard: "查看榜单",

    pending_reward: "待释放奖励池",
    pending_reward_desc: "30天考核期 · 期满全额解锁",
    today_available: "已释放代币", 
    click_harvest: "一键领取",
    wait_release: "考核进行中...",
    harvest_btn: "收取收益", 

    my_referrals: "我的直推人数",
    click_to_view: "点击查看",

    rules_title: "⚔️ 指挥官晋升法则",
    rule_1: "🚀 5% 直推奖励",
    rule_1_desc: "您的下级买入 MGT，您立刻获得其买入金额 5% 的奖励进入锁定池。",
    rule_2: "⏳ 30天 钻石手考核",
    rule_2_desc: "所有奖励锁定 30 天 (悬崖释放)。考核期满后，一次性全额解锁。",
    rule_3: "🩸 动态回撤 (防砸盘)",
    rule_3_desc: "考核期内，若您的下级卖出 MGT，系统将自动扣除您对应的锁定奖励。共识致富！",
    rule_4: "💎 领取资格",
    rule_4_desc: "坚持持有满 30 天且下级未清仓，奖励全额归您所有。",
    rule_5: "🏆 榜单空投激励",
    rule_5_desc: "实时更新全网直推业绩。冲击排行榜前十名，未来将获得额外的代币空投与生态权益。",
    got_it_btn: "明白了，开始赚钱 🚀",

    intro_title: "$MGT 核心愿景",
    intro_core_title: "Solana × 全球非遗",
    intro_core_desc: "全球首个将 Solana 高速区块链技术与【全球非物质文化遗产】深度融合的数字资产。",
    intro_safe_title: "生态落地 & 兑换",
    intro_safe_desc: "$MGT 打通虚实边界，代币可直接用于【兑换全球非遗珍品】与传承体验。",
    intro_ca_label: "合约地址 (点击复制)",
    intro_tag_1: "🎁 实物兑换",
    intro_tag_2: "🏮 文化传承",

    claim_loading: "正在核对考核期...",
    manual_bind_title: "手动绑定上级",
    manual_bind_placeholder: "输入地址...",
    confirm_bind: "确认绑定",
    success_bind: "自动绑定成功！🤝",
    success_manual_bind: "绑定上级成功！🎉",
    success_connect: "连接成功",
    addr_copied: "地址已复制到剪贴板 ✅",
    footer_built: "去中心化平台 | 基于 Solana 构建",
    footer_rights: "© 2025 Solana. 版权所有.",

    modal_lb_title: "实时推广排行榜",
    modal_lb_desc: "数据实时更新，竞争顶级荣耀",
    modal_lb_tip: "努力推广，下一个榜一就是你！",
    modal_lb_close: "关闭榜单",

    ref_modal_title: "直推伙伴",
    loading: "加载中...",
    copy_success: "已复制地址",
    copy_btn: "复制",
    no_ref_data: "还没有直推伙伴，快去邀请吧！",
    close_btn: "关闭列表",
  },
  en: {
    connect: "Connect",
    more_leaderboard: "Leaderboard",
    more_rules: "Rules",
    more_intro: "Vision",
    lang_switch: "Language / 语言",
    hero_title: "$MGT Legion",
    hero_desc: "Connect wallet to start ",
    hero_desc_highlight: "5% Cashback",
    hero_desc_end: " journey!",
    ca_copied: "CA Copied! Let's go to OKX!",
    link_copied: "Referral link copied! Share it now!",
    buy_btn_main: "Buy $MGT on OKX Now",
    buy_btn_sub: "Fast Swap with USDT / SOL",
    my_Leader: "My Leader",
    bind_btn: "Bind Referrer +",
    referral_link: "Referral Link",
    copy_link: "Copy Link",

    team_volume: "My Direct Volume",
    team_volume_desc: "Direct Vol (USDT)",
    check_leaderboard: "View Rank",

    pending_reward: "Locked Reward Pool",
    pending_reward_desc: "30-Day Cliff · Full Unlock",
    today_available: "Claimable Now",
    click_harvest: "Harvest Now",
    wait_release: "In Testing...",
    harvest_btn: "Harvest",

    my_referrals: "My Referrals",
    click_to_view: "View Details",

    rules_title: "⚔️ Leader Rules",
    rule_1: "🚀 5% Direct Reward",
    rule_1_desc: "Earn 5% reward immediately when invitee buys. Rewards go to Locked Pool.",
    rule_2: "⏳ 30-Day Diamond Hand",
    rule_2_desc: "Rewards are locked for 30 days (Cliff). You claim 100% after the period ends.",
    rule_3: "🩸 Dynamic Clawback (Anti-Dump)",
    rule_3_desc: "If invitee sells during lock period, your rewards are deducted. Hold together!",
    rule_4: "💎 Eligibility",
    rule_4_desc: "Pass the 30-day test to claim full rewards.",
    rule_5: "🏆 Leaderboard Airdrop",
    rule_5_desc: "Top 10 Leaders on the global volume leaderboard will receive exclusive airdrops and benefits.",
    got_it_btn: "Got it, Start Earning 🚀",

    intro_title: "Vision of $MGT",
    intro_core_title: "Solana × Global ICH",
    intro_core_desc: "The world's first digital asset integrating Solana speed with Global Intangible Cultural Heritage.",
    intro_safe_title: "Ecosystem Redemption",
    intro_safe_desc: "$MGT ecosystem allows you to redeem authentic ICH treasures and experiences.",
    intro_ca_label: "Contract Address (Tap to Copy)",
    intro_tag_1: "🎁 Real-world Redeem",
    intro_tag_2: "🏮 Cultural Legacy",

    claim_loading: "Verifying...",
    manual_bind_title: "Bind Referrer Manually",
    manual_bind_placeholder: "Enter address...",
    confirm_bind: "Confirm Bind",
    success_bind: "Auto bind successful! 🤝",
    success_manual_bind: "Bind successful! 🎉",
    success_connect: "Connected Successfully",
    addr_copied: "Address copied to clipboard ✅",
    footer_built: "Decentralized Platform | Built on Sol",
    footer_rights: "© 2025 Solana. All rights reserved.",

    modal_lb_title: "Live Referral Leaderboard",
    modal_lb_desc: "Real-time updates. Compete for top glory.",
    modal_lb_tip: "Keep pushing! The next Top 1 could be you!",
    modal_lb_close: "Close Leaderboard",

    ref_modal_title: "Direct Partners",
    loading: "Loading...",
    copy_success: "Address Copied",
    copy_btn: "Copy",
    no_ref_data: "No partners yet. Go invite!",
    close_btn: "Close List",
  }
};

declare global {
  interface Window {
    Jupiter: any;
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, duration: 0.4 } },
};

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
  const [lockedReward, setLockedReward] = useState(0); 
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const hasShownWelcome = useRef(false);
  const [showClaimSuccess, setShowClaimSuccess] = useState(false);
  const [lastReleasedAmount, setLastReleasedAmount] = useState(0); 
  const [countDownStr, setCountDownStr] = useState("");
  const [isBinding, setIsBinding] = useState(false); 
  const [manualReferrer, setManualReferrer] = useState(""); 
  const [showRules, setShowRules] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = translations[lang];
  const [showRefListModal, setShowRefListModal] = useState(false);
  const [refList, setRefList] = useState<string[]>([]); 
  const [loadingRefList, setLoadingRefList] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [lastVestingTime, setLastVestingTime] = useState<string | null>(null);
  const [liveClaimable, setLiveClaimable] = useState(0);
  const [lastTxHash, setLastTxHash] = useState("");
  const handleShowReferrals = async () => {
    if (!publicKey) return;
    
    setLoadingRefList(true);
    setShowRefListModal(true);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet')
        .eq('referrer', publicKey.toBase58())
        .order('created_at', { ascending: false })
        .limit(20);

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

  useEffect(() => {
    const STORAGE_KEY = "mgt_has_shown_welcome";

    if (connected && publicKey) {
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

  const handleManualBind = async () => {
    if (!publicKey || !signMessage) return;
    if (!manualReferrer || manualReferrer.length < 32) {
        toast.error("无效地址");
        return;
    }
    if (manualReferrer === publicKey.toBase58()) {
        toast.error("不能绑定自己");
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
        toast.error(err.message || "绑定失败");
    }
  };

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

          const { data: financeData } = await supabase
            .from("users")
            .select("locked_reward, team_volume, last_vesting_time")
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

  useEffect(() => {
    if (!connected || !publicKey) return;

    const channel = supabase
      .channel('realtime_users_updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `wallet=eq.${publicKey.toBase58()}`
        },
        (payload) => {
          const newUser = payload.new as any;
          if (newUser) {
            console.log("⚡️ 收到实时更新:", newUser);
            setLockedReward(newUser.locked_reward || 0); 
            setTeamVolume(newUser.team_volume || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connected, publicKey]);

  useEffect(() => {
    if (!lockedReward || lockedReward <= 0) {
      setLiveClaimable(0);
      return;
    }

    const checkAvailability = () => {
      const now = new Date();
      const lastTime = lastVestingTime ? new Date(lastVestingTime) : new Date(0);
      const offset = 8 * 60 * 60 * 1000; 
      const bjNowTs = now.getTime() + offset;
      const bjLastTs = lastTime.getTime() + offset;
      const dayNow = Math.floor(bjNowTs / (1000 * 60 * 60 * 24));
      const dayLast = Math.floor(bjLastTs / (1000 * 60 * 60 * 24));
      const daysPassed = dayNow - dayLast;
      const isZh = lang === 'zh'; 

      if (daysPassed >= 1) {
        const CLEAR_THRESHOLD = 10;
        let amount = 0;

        if (lockedReward <= CLEAR_THRESHOLD) {
            amount = lockedReward; 
        } else {
             amount = (lockedReward / 30) * daysPassed; 
        }

        amount = Math.min(amount, lockedReward);
        setLiveClaimable(amount);
        setCountDownStr(isZh 
            ? `🔥 已累积 ${daysPassed} 天收益 🔥` 
            : `🔥 Accumulated ${daysPassed} days profit 🔥`);

      } else {
        setLiveClaimable(0); 
        const msInDay = 1000 * 60 * 60 * 24;
        const currentDayMs = bjNowTs % msInDay;
        const diff = msInDay - currentDayMs;
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setCountDownStr(isZh
            ? `下轮累积: ${h}时${m}分${s}秒`
            : `Next Accumulation: ${h}h ${m}m ${s}s`);
      }
    };

    checkAvailability(); 
    const interval = setInterval(checkAvailability, 1000);
    return () => clearInterval(interval);
  }, [lockedReward, lastVestingTime, lang]); 

  const claimReward = async () => {
    if (!publicKey) return toast.error(lang === 'zh' ? "请先连接钱包" : "Connect wallet first");
    if (lockedReward <= 0) {
        toast.error(lang === 'zh' ? "暂无奖励可释放" : "No rewards available");
        return;
    }

    setClaiming(true);
    const toastId = toast.loading(lang === 'zh' ? "正在核对考核期..." : "Verifying vesting period...");

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58() }),
      });
      
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "请求失败");

      setLockedReward(0);
      setLiveClaimable(0);
      setLastReleasedAmount(data.amount || lockedReward);
      setLastTxHash(data.tx || "");
      setShowClaimSuccess(true);
      
      toast.success(lang === 'zh' ? "领取成功！" : "Claim Successful!", { id: toastId });
      const isMobile = window.innerWidth < 768;
      confetti({
        particleCount: isMobile ? 60 : 150, 
        spread: isMobile ? 50 : 70,       
        origin: { y: 0.6 },
        colors: ['#22c55e', '#eab308', '#a855f7'],
        disableForReducedMotion: true,    
        scalar: isMobile ? 0.8 : 1,       
      });

      setTimeout(() => {
          if (typeof fetchUserData === 'function') fetchUserData(); 
      }, 3000);

    } catch (err: any) {
      console.error("Claim Error:", err);
      
      if (err.message.includes("Time") || err.message.includes("timeout")) {
          toast.success(lang === 'zh' ? "请求已提交，请稍后查看" : "Request submitted", { id: toastId });
      } else {
          toast.error(err.message, { 
            id: toastId,
            duration: 4000,
            style: {
                background: '#333',
                color: '#fff',
                border: '1px solid #EF4444'
            }
          });
      }
    } finally {
      setClaiming(false);
    }
  };

  const getVestingStatus = () => {
    if (lockedReward <= 0 || !lastVestingTime) return null;

    const LOCK_DAYS = 30;
    const now = Date.now();
    const last = new Date(lastVestingTime).getTime();
    const daysPassed = (now - last) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.ceil(LOCK_DAYS - daysPassed);

    if (daysLeft > 0) {
      return { 
        isReady: false, 
        text: lang === 'zh' ? `⏳ 考核中：还需 ${daysLeft} 天` : `⏳ Testing: ${daysLeft} days left` 
      };
    } else {
      return { 
        isReady: true, 
        text: lang === 'zh' ? `🔓 考核达标！可全额领取` : `🔓 Unlocked! Claim All` 
      };
    }
  };

  const vestingStatus = getVestingStatus();
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
        key="home-page"
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
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/20 rounded-full blur-[60px] -z-10"></div>
              <div className="mx-auto w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-6 border border-green-500/20">
                  <span className="text-4xl animate-bounce">💸</span>
              </div>

                <h3 className="text-2xl font-black text-white mb-2 tracking-wide">
                  成功释放!
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  本次释放金额：<br/>
                  <span className="text-2xl font-bold text-yellow-400">{lastReleasedAmount.toFixed(4)} MGT</span>
                  <br/><span className="text-xs text-green-400 mt-2 block font-bold">✅ 资金已自动发送至您的钱包！</span>
                      <a href={`https://solscan.io/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 underline mt-1 block">查看链上交易记录 (Solscan)</a>
                </p>

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

        <AnimatePresence>
            {showRules && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="w-full max-w-lg bg-[#16171D] border border-blue-500/20 rounded-3xl shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)] relative overflow-hidden"
                    >
                        {/* 背景光效 */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-500/10 rounded-full blur-[60px] -z-10 pointer-events-none"></div>
                        
                        {/* 顶部标题栏 */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-2xl font-black flex items-center gap-3 relative z-10">
                                {/* 🌟 核心修改：高级感流光渐变文字 */}
                                <span className="bg-clip-text text-transparent bg-[linear-gradient(135deg,#e2e8f0_0%,#a78bfa_50%,#f472b6_100%)] drop-shadow-[0_2px_10px_rgba(167,139,250,0.5)] filter brightness-110 tracking-wide">
                                    {t.rules_title}
                                </span>

                                {/* V2.0 徽章：也做个配套升级，让它亮一点 */}
                                <span className="text-xs font-bold text-indigo-200/80 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-400/30 shadow-[0_0_10px_rgba(99,102,241,0.2)] backdrop-blur-sm">
                                    V1.0
                                </span>
                            </h3>
                            <button 
                                onClick={() => setShowRules(false)} 
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all border border-transparent hover:border-white/20"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            
                            {/* 🟢 规则 1: 5% 直推奖励 */}
                            <div className="group flex gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-blue-500/30 hover:bg-black/40 transition-all duration-300">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-xl group-hover:scale-110 transition-transform">
                                    🚀
                                </div>
                                <div>
                                    <h4 className="text-blue-100 font-bold text-sm mb-1">{t.rule_1}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t.rule_1_desc}
                                    </p>
                                </div>
                            </div>

                            {/* 🟡 规则 2: 30天悬崖考核 */}
                            <div className="group flex gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-yellow-500/30 hover:bg-black/40 transition-all duration-300">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 text-xl group-hover:scale-110 transition-transform">
                                    ⏳
                                </div>
                                <div>
                                    <h4 className="text-yellow-100 font-bold text-sm mb-1">{t.rule_2}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t.rule_2_desc}
                                    </p>
                                </div>
                            </div>

                            {/* 🔴 规则 3: 动态回撤 (红色警示风格) */}
                            <div className="group flex gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-red-500/40 hover:bg-red-900/10 transition-all duration-300">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 text-xl group-hover:scale-110 transition-transform">
                                    🩸
                                </div>
                                <div>
                                    {/* 标题用红色，强调严重性 */}
                                    <h4 className="text-red-200 font-bold text-sm mb-1">{t.rule_3}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed group-hover:text-gray-300">
                                        {t.rule_3_desc}
                                    </p>
                                </div>
                            </div>

                            {/* 💎 规则 4: 领取资格 */}
                            <div className="group flex gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-cyan-500/30 hover:bg-black/40 transition-all duration-300">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-xl group-hover:scale-110 transition-transform">
                                    💎
                                </div>
                                <div>
                                    <h4 className="text-cyan-100 font-bold text-sm mb-1">{t.rule_4}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t.rule_4_desc}
                                    </p>
                                </div>
                            </div>

                            <div className="group flex gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-purple-500/40 hover:bg-black/40 transition-all duration-300">
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-xl group-hover:scale-110 transition-transform">
                                    🏆
                                </div>
                                <div>
                                    <h4 className="text-purple-200 font-bold text-sm mb-1">{t.rule_5}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {t.rule_5_desc}
                                    </p>
                                </div>
                            </div>

                        </div>

                        <div className="p-5 border-t border-white/5 bg-black/20">
                            <button 
                                onClick={() => setShowRules(false)}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all text-sm tracking-wide"
                            >
                                {t.got_it_btn}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>

        {/* ℹ️ 项目介绍弹窗 (非遗文化限定版) */}
        <AnimatePresence>
            {showIntro && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, rotateX: 10 }}
                        animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                        exit={{ opacity: 0, scale: 0.9, rotateX: 10 }}
                        className="w-full max-w-lg bg-[#121212] border border-white/10 rounded-3xl shadow-[0_0_80px_-20px_rgba(168,85,247,0.4)] relative overflow-hidden"
                    >
                        {/* 🏮 背景氛围：左下紫气东来，右上金光闪耀 */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-56 h-56 bg-purple-600/15 rounded-full blur-[60px] -z-10 pointer-events-none"></div>

                        {/* 🏷️ 标题栏 */}
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 flex items-center gap-2">
                                ℹ️ {t.intro_title} 
                            </h3>
                            <button 
                                onClick={() => setShowIntro(false)} 
                                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {/* 📜 内容区 */}
                        <div className="p-6 space-y-5">
                            
                            {/* 1. 核心愿景卡片 (Solana x 非遗) */}
                            <div className="group relative p-5 rounded-2xl bg-gradient-to-br from-[#1A1A2E] to-[#16213E] border border-blue-500/20 overflow-hidden hover:border-blue-500/40 transition-all">
                                {/* 装饰图标 */}
                                <div className="absolute top-2 right-3 text-5xl opacity-10 group-hover:opacity-20 transition-opacity grayscale group-hover:grayscale-0">
                                    🌏
                                </div>
                                <div className="relative z-10">
                                    <h4 className="text-blue-200 font-bold text-base mb-2 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                        {t.intro_core_title}
                                    </h4>
                                    <p className="text-xs md:text-sm text-gray-400 leading-relaxed text-justify">
                                        {t.intro_core_desc}
                                    </p>
                                </div>
                            </div>

                            {/* 2. 生态落地卡片 (实物兑换) */}
                            <div className="group relative p-5 rounded-2xl bg-gradient-to-br from-[#1F1100] to-[#2E1A05] border border-amber-500/20 overflow-hidden hover:border-amber-500/40 transition-all">
                                {/* 装饰图标 - 琥珀色光晕 */}
                                <div className="absolute -inset-1 bg-amber-500/5 blur-xl group-hover:bg-amber-500/10 transition-all"></div>
                                <div className="absolute top-2 right-3 text-5xl opacity-10 group-hover:opacity-20 transition-opacity grayscale group-hover:grayscale-0">
                                    🏺
                                </div>
                                
                                <div className="relative z-10">
                                    <h4 className="text-amber-200 font-bold text-base mb-2 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                                        {t.intro_safe_title}
                                    </h4>
                                    <p className="text-xs md:text-sm text-gray-400 leading-relaxed text-justify">
                                        {t.intro_safe_desc}
                                    </p>
                                    {/* 标签 */}
                                    <div className="mt-3 flex gap-2">
                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
                                            {t.intro_tag_1}
                                        </span>
                                        <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
                                            {t.intro_tag_2}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 3. CA 复制交互区 */}
                            <div className="space-y-2 pt-2">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">{t.intro_ca_label}</p>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(contractAddress);
                                        toast.success(t.addr_copied);
                                        if (navigator.vibrate) navigator.vibrate(50);
                                    }}
                                    className="w-full flex items-center justify-between bg-black/40 hover:bg-black/60 border border-white/10 hover:border-purple-500/30 rounded-xl p-4 transition-all group active:scale-95"
                                >
                                    <div className="flex flex-col items-start gap-1 overflow-hidden">
                                        <span className="text-xs font-mono font-bold text-purple-400 break-all text-left">
                                            {contractAddress}
                                        </span>
                                    </div>
                                    <span className="shrink-0 bg-white/5 p-2 rounded-lg group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
                                        📄
                                    </span>
                                </button>
                            </div>

                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
          
        {/* 主容器：直通模式 (Direct Mode) */}
        <div className="container mx-auto px-4 pt-16 md:pt-20 pb-10 text-center flex-grow"> 
            <motion.div variants={containerVariants} className="max-w-5xl mx-auto space-y-6 md:space-y-8">
              
              {/* 🟢 OKX 抢购卡片 (精致宽幅版) */}
              <div className="mt-4 md:mt-8 flex justify-center pb-2 w-full">
                <button
                  onClick={openOkxDex}
                  className="w-full max-w-md md:max-w-5xl relative group cursor-pointer overflow-hidden rounded-2xl md:rounded-3xl shadow-lg hover:shadow-green-500/40 transition-all duration-300 transform md:hover:-translate-y-1"
                >
                    {/* 背景动画 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 animate-gradient-x"></div>
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
                    
                    {/* 内容区域：高度回调到 md:py-6，更加紧凑 */}
                    <div className="relative px-6 py-4 md:py-6 flex flex-col items-center justify-center">
                        <div className="flex items-center gap-3 md:gap-4">
                            {/* 图标：大小适中 */}
                            <span className="text-3xl md:text-4xl animate-bounce">💊</span>
                            
                            {/* 主标题：字号 text-2xl/3xl，醒目但不过分 */}
                            <span className="text-xl md:text-3xl font-black text-white tracking-wide uppercase drop-shadow-md">
                                {t.buy_btn_main}
                            </span>
                        </div>
                        
                        {/* 副标题 */}
                        <span className="text-green-100 text-xs md:text-sm font-bold mt-1 md:mt-2 bg-black/20 px-3 md:px-4 py-0.5 md:py-1 rounded-full backdrop-blur-sm">
                            {t.buy_btn_sub}
                        </span>
                    </div>
                </button>
              </div>

              {/* 2. 财务数据 (双卡片布局) */}
              <motion.div 
                variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { delay: 0.6, duration: 0.6 } } }}
                initial="hidden" 
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
              >
                {/* 💰 卡片 1：直推总业绩 */}
              <motion.div
                onClick={() => setShowLeaderboardModal(true)} 
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.03)" }}
                whileTap={{ scale: 0.98 }}
                className="cursor-pointer relative overflow-hidden p-6 rounded-2xl border border-gray-800/50 bg-[#16171D]/50 backdrop-blur-sm flex items-center justify-between group hover:border-blue-500/30 transition-all shadow-lg"
              >
              <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-gray-400 text-sm font-medium">{t.team_volume}</p>
                  <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">USD</span>
                  {/* 查看榜单 */}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 font-bold">
                      {t.check_leaderboard}
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-2">{t.team_volume_desc}</p>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white tracking-tight relative z-10">
                    {connected ? `$${teamVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
                  </span>
                </div>
              </div>

                {/* 图标装饰 */}
                <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  <span className="text-2xl">🏆</span>
                </div>
              </motion.div>

              {/* 🎁 卡片 2：锁仓与释放 (核心功能) */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-6 rounded-2xl border border-gray-800/50 bg-[#16171D]/50 backdrop-blur-sm flex items-center justify-between group hover:border-green-500/30 transition-all shadow-lg"
              >
                <div className="flex flex-col gap-3">
                  {/* 上半部分：总金库 */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-gray-500 text-xs font-medium">{t.pending_reward}</p>
                      <span className="text-[9px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">
                        {t.pending_reward_desc}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 opacity-70">
                      <span className="text-lg font-bold text-gray-300 font-mono">
                        {connected ? lockedReward.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </span>
                      <span className="text-xs text-gray-600">MGT</span>
                    </div>
                  </div>

                  <div className="w-full h-px bg-gray-800/50"></div>

                  {/* 下半部分：今日可领 (带倒计时) */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm font-bold flex items-center gap-1 ${liveClaimable > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                            {liveClaimable > 0 ? (
                                <>
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                  {t.today_available}
                                </>
                            ) : (
                                <>
                                  <span>⏳</span> {countDownStr || "Thinking..."}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl md:text-4xl font-black tracking-tight font-mono ${liveClaimable > 0 ? 'text-white' : 'text-gray-500'}`}>
                        {connected && liveClaimable > 0 ? liveClaimable.toFixed(4) : "0.0000"}
                      </span>
                      <span className="text-sm text-gray-600 font-bold">MGT</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center shrink-0 ml-4 md:ml-8 md:w-56 transition-all">
                  
                  <button
                    onClick={claimReward}
                    // ⚠️ 逻辑优化：Loading 时禁用点击，但不要变成灰色，保持绿色
                    disabled={!connected || claiming} 
                    className={`
                      relative btn-click-effect overflow-hidden rounded-2xl font-bold transition-all shadow-lg flex flex-col items-center justify-center 
                      /* 📱 手机端：宽度 w-32，高度 py-4 */
                      w-32 py-4 
                      /* 💻 电脑端：宽度 100% (跟随容器)，高度 py-7 */
                      md:w-full md:py-7
                      
                      ${(!connected)
                        ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700" // 没连钱包显示灰色
                        : "bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-green-500/20 border border-green-400/20" // 连了钱包（包括Loading）一直保持绿色
                      }
                      
                      ${claiming ? "cursor-wait opacity-90" : "hover:scale-105 hover:shadow-green-500/40"}
                    `}
                  >
                    {/* 🔄 Loading 遮罩层 (绝对定位，悬浮在文字上面) */}
                    {claiming && (
                      <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/50 backdrop-blur-[2px] z-10">
                        <div className="w-6 h-6 border-2 border-white/90 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}

                    {/* 📝 文字层 (Loading 时变透明，但依然占位，防止按钮变小) */}
                    <div className={`flex flex-col items-center transition-opacity duration-200 ${claiming ? "opacity-0" : "opacity-100"}`}>
                      {/* 📱 手机 text-xl，💻 电脑 text-3xl */}
                      <span className="text-xl md:text-3xl mb-1 drop-shadow-md">{t.harvest_btn}</span>
                      
                      {/* 副标题 */}
                      <span className="text-[10px] md:text-xs opacity-80 uppercase tracking-widest scale-90 md:scale-100">
                        {lockedReward > 0 ? t.click_harvest : t.wait_release}
                      </span>
                    </div>
                  </button>

                  {vestingStatus && (
                    <div className={`
                      /* 📱 手机：紧凑 mt-2 */
                      mt-2 px-2 py-1.5 text-[10px] 
                      /* 💻 电脑：宽松 mt-3，字号 text-sm，内边距 py-2.5 */
                      md:mt-3 md:px-4 md:py-2.5 md:text-sm
                      
                      w-full flex justify-center items-center gap-1.5 rounded-xl font-bold border border-dashed whitespace-nowrap transition-all
                      ${vestingStatus.isReady 
                        ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]' 
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                      }
                    `}>
                      {vestingStatus.text.replace("考核中：", "")}
                    </div>
                  )}

                </div>
              </motion.div>
              </motion.div>

              {/* 3. K线图 */}
              <div className="text-xl font-bold flex items-center gap-2 md:hidden">
                  {/* 👇 判断：如果是中文(zh)显示"实时价格"，否则显示"MGT Price" */}
                  {lang === 'zh' ? 'MGT 实时价格' : 'MGT Price'}: <PriceTicker />
              </div>

              {/* K线图 */}
              <div className="hidden md:block w-full mt-6 mb-10">
                <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
                  📊 实时走势 (Live Chart)
                </div>
                <div className="w-full h-[500px] rounded-2xl overflow-hidden border border-gray-800/50 bg-black/40 backdrop-blur-sm shadow-2xl">
                  <PriceChart 
                    tokenAddress="59eXaVJNG441QW54NTmpeDpXEzkuaRjSLm8M6N4Gpump" 
                    lang="zh" 
                  />
                </div>
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
                    <p className="text-gray-400 text-xs md:text-sm mb-2">{t.my_Leader}</p>
                    {inviter ? (
                        <div className="flex items-center space-x-2 bg-black/30 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-gray-700">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <p className="text-xs md:text-sm font-mono font-bold text-gray-200">
                                {`${inviter.slice(0, 4)}...${inviter.slice(-4)}`}
                            </p>
                        </div>
                    ) : (
                        <button 
                            onClick={() => {
                                if (!connected) toast.error("请先连接钱包");
                                else setIsBinding(true);
                            }}
                            className="flex btn-click-effect items-center space-x-2 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 px-4 py-1.5 rounded-full transition-all group"
                        >
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-xs md:text-sm font-bold text-purple-200 group-hover:text-white">
                                {t.bind_btn}
                            </span>
                        </button>
                    )}
                  </div>

                  {/* 👥 直推人数卡片 */}
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleShowReferrals} 
                    className="bg-[#16171D] p-6 rounded-2xl border border-gray-800/50 hover:border-blue-500/50 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <span className="text-6xl">👥</span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-gray-400 text-sm font-medium">{t.my_referrals}</p>
                        {/* 提示小图标 */}
                      <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded">{t.click_to_view}</span>
                    </div>

                    <div className="flex items-end gap-2">
                      <h3 className="text-4xl font-black text-white tracking-tight">
                        {connected ? myRefs : 0}
                      </h3>
                      <span className="text-gray-500 mb-1.5 font-bold">人</span>
                    </div>
                  </motion.div>

                  <div className="flex flex-col items-center justify-center p-4 w-full">
                    <p className="text-gray-400 text-xs md:text-sm mb-3">{t.referral_link}</p>
                    <button
                        onClick={() => {
                          if (!connected) {
                              toast.error("请先连接钱包");
                              return;
                          }
                          const shareText = `${myLink}`;
                          navigator.clipboard.writeText(shareText);
                          toast.success(t.link_copied);
                        }}
                        disabled={!connected} 
                        className="w-full md:w-auto px-6 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-full text-sm font-bold text-white shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t.copy_link}
                      </button>
                  </div>
                </div>
              </motion.div>

            </motion.div>
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
                    👥 {t.ref_modal_title} ({refList.length})
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
                      {t.loading}
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
                              toast.success(t.copy_success);
                            }}
                            className="text-gray-600 hover:text-blue-400 text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition-all"
                          >
                            {t.copy_btn}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      <p className="text-4xl mb-2">🏜️</p>
                      <p>{t.no_ref_data}</p>
                    </div>
                  )}
                </div>
                
                {/* 底部按钮 */}
                <div className="p-4 border-t border-gray-800 bg-black/20">
                    <button 
                        onClick={() => setShowRefListModal(false)}
                        className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold transition-all"
                    >
                        {t.close_btn}
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
                className="w-full max-w-4xl bg-[#16171D] border border-gray-800 rounded-3xl overflow-hidden shadow-[0_0_50px_-10px_rgba(168,85,247,0.2)] flex flex-col h-[85vh] relative"
              >
                {/* ✨ 背景氛围光 (新增) */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10 pointer-events-none"></div>

                {/* 弹窗头部 */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl filter drop-shadow-md">📊</span>
                    <div>
                        {/* 🌟 标题升级：高级流光渐变 */}
                        <h3 className="text-xl font-black bg-clip-text text-transparent bg-[linear-gradient(135deg,#e2e8f0_0%,#a78bfa_50%,#f472b6_100%)] drop-shadow-[0_2px_10px_rgba(167,139,250,0.5)] tracking-wide">
                            {t.modal_lb_title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">{t.modal_lb_desc}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowLeaderboardModal(false)} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white border border-transparent hover:border-white/20 transition-all">
                    ✕
                  </button>
                </div>

                {/* 内容区域 - 放入 Leaderboard 组件 */}
                <div className="flex-1 overflow-hidden bg-[#0b0c10]/50 relative">
                    <Leaderboard currentUserWallet={publicKey?.toBase58()} />
                </div>
                
                {/* 底部关闭栏 */}
                <div className="p-5 border-t border-gray-800 bg-[#16171D] text-center z-10">
                    <p className="text-xs text-gray-500 mb-3 font-medium tracking-wide">
                        {t.modal_lb_tip}
                    </p>
                    <button 
                        onClick={() => setShowLeaderboardModal(false)}
                        className="w-full md:w-auto px-16 py-3.5 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white rounded-xl font-bold transition-all border border-gray-600/50 shadow-lg active:scale-95"
                    >
                        {t.modal_lb_close}
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
