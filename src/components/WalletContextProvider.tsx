"use client";

import { FC, ReactNode, useMemo, useEffect, useState, useCallback } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
const endpoint = "https://mgt-lunarlegacy.2824889114.workers.dev";
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const onError = useCallback((error: WalletError) => {
    console.error("Wallet error:", error);
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 500); 
    return () => clearTimeout(timer);
  }, []);

  return (
    <ConnectionProvider 
        endpoint={endpoint}
        config={{ commitment: 'confirmed' }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true} 
        onError={onError}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );  
};

export default WalletContextProvider;
