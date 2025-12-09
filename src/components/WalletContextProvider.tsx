"use client";

import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { toast } from "react-hot-toast";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const endpoint = "https://mainnet.helius-rpc.com/?api-key=f6ac37ee-435b-440c-9114-87bf7783319b";
  const wallets = useMemo(() => [], []);

return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect
        onError={(error) => {
            console.error("钱包错误:", error);
            toast.error(`连接错误: ${error.name} - ${error.message}`, {
                style: { background: '#333', color: '#fff', wordBreak: 'break-all' },
                duration: 5000 
            });
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;
