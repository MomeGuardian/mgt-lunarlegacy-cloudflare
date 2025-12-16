"use client";

import { FC, ReactNode, useMemo, useEffect } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    // 如果你有装 @solana/wallet-adapter-okx，也可以引入，没有的话也没关系，通用适配器能抓到
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

// 👇 这是一个“幽灵组件”，专门负责自动连 OKX
const AutoWalletSelector = () => {
    const { select, wallets, connected, connecting } = useWallet();

    useEffect(() => {
        if (connected || connecting) return;

        // 🕵️‍♂️ 2025 最新嗅探技术：检测是否在 OKX APP 环境中
        const isOKXApp = 
            typeof window !== "undefined" && 
            ((window as any).okxwallet || (navigator.userAgent.includes("OKApp")));

        if (isOKXApp) {
            console.log("🚀 检测到 OKX 钱包环境，正在强制连接...");
            
            // 尝试找到适配 OKX 的适配器
            // 大多数时候 OKX 会伪装成 'Standard Wallet' 或 'Phantom'
            // 我们优先选 Standard 或者第一个检测到的 Injected 钱包
            const okxAdapter = wallets.find(w => w.adapter.name === 'OKX Wallet') || 
                              wallets.find(w => w.adapter.name.includes('OKX')) ||
                              wallets.find(w => w.readyState === "Installed");

            if (okxAdapter) {
                select(okxAdapter.adapter.name);
            }
        }
    }, [connected, connecting, select, wallets]);

    return null; // 它不渲染任何东西
};

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // ✅ 必须用你最新的 Cloudflare Worker 地址
    const endpoint = "https://mgt-lunarlegacy.2824889114.workers.dev";

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            // 这里的顺序很重要，但在 OKX App 里，上面的嗅探代码会无视顺序直接抓取
        ],
        []
    );

    const onError = (error: any) => {
        console.error("Wallet Error:", error);
    };

    return (
        <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
            <WalletProvider 
                wallets={wallets} 
                autoConnect={true} // ✅ 保持开启，用于老用户
                onError={onError}
            >
                <WalletModalProvider>
                    {/* 👇 插入我们的嗅探器 */}
                    <AutoWalletSelector />
                    
                    {/* 直接显示内容，实现秒开 */}
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
