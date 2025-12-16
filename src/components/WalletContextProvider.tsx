"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    // 我们不需要专门引入 OKX Adapter，因为它会自动注入到 standard list 里
    // 或者它会伪装成 Phantom，这在移动端兼容性最好
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // ✅ 保持你最新的 Cloudflare Worker 高速节点
    const endpoint = "https://mgt-lunarlegacy.2824889114.workers.dev";

    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
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
                autoConnect={true} // ✅ 保持 true：连过一次后，下次自动连
                onError={onError}
            >
                {/* 👇 这个 Provider 负责弹出那个“选择钱包”的黑框框 */}
                <WalletModalProvider>
                    {/* 直接显示内容，网页秒开，点击右上角按钮才会弹窗 */}
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
