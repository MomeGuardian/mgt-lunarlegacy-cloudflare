"use client";

import { FC, ReactNode, useMemo } from "react";
// 保留 ConnectionProvider 用于连接你的高速节点
import { ConnectionProvider } from "@solana/wallet-adapter-react";
// 引入 Jupiter 的 Unified 组件
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // ✅ 保持你原本的 Cloudflare Worker 高速节点
    const endpoint = "https://mgt-lunarlegacy.2824889114.workers.dev";

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        []
    );

    return (
        // 1. 最外层：网络连接层 (保持不变，确保 RPC 通信正常)
        <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
            
            {/* 2. 钱包交互层：使用 UnifiedWalletProvider 替换掉旧的 WalletProvider + Modal */}
            <UnifiedWalletProvider
                wallets={wallets}
                config={{
                    autoConnect: true, // 保持自动连接
                    env: "mainnet-beta",
                    metadata: {
                        name: "MGT Lunar Legacy",
                        description: "MGT Project",
                        url: "https://mgt.lunarlegacy.io", // 建议替换为你网站的真实域名
                        iconUrls: [], // 可选：填入你的 Logo URL
                    },
                    theme: "dark", // 深色模式，适配你的 UI
                    lang: "zh",    // 设置中文
                }}
            >
                {children}
            </UnifiedWalletProvider>
            
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
