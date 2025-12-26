"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { UnifiedWalletProvider } from "@jup-ag/wallet-adapter";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const endpoint = "https://mgt-lunarlegacy.2824889114.workers.dev";

    const wallets = useMemo(() => [], []);

    return (
        <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
            <UnifiedWalletProvider
                wallets={wallets}
                config={{
                    autoConnect: true,
                    env: "mainnet-beta",
                    metadata: {
                        name: "MGT Lunar Legacy",
                        description: "MGT Project",
                        url: "https://mgt.lunarlegacy.io",
                        iconUrls: ["https://mgt.lunarlegacy.io/favicon.ico"], 
                    },
                    theme: "dark",
                    lang: "zh",
                }}
            >
                {children}
            </UnifiedWalletProvider>
        </ConnectionProvider>
    );
};

export default WalletContextProvider;
