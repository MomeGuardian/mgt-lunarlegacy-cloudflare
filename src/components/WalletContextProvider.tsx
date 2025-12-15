"use client";

import { FC, ReactNode, useMemo, useEffect, useState, useCallback } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

const WalletContextProvider: FC<{ children: ReactNode }> = ({ children }) => {
const endpoint = "https://rpc.mgt-token.company/30487788f9c117978bd9ced0e23044c9c7ae0c36";

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
            {mounted ? children : (
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-xs text-gray-400 font-mono">Initializing MGT...</div>
                </div>
            )}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );  
};

export default WalletContextProvider;
