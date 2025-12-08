"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { OKXSolanaProvider } from "@okxconnect/solana-provider";
import { OKXUniversalProvider } from "@okxconnect/universal-provider";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

export default function WalletContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const [okxProvider, setOkxProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initOKX = async () => {
      try {
        const universalProvider = await OKXUniversalProvider.init({
          dappMetaData: {
            name: "MGT Lunar Legacy",
            icon: "/favicon.ico",
          },
        });
        const okxSolana = new OKXSolanaProvider(universalProvider);
        if (typeof window !== 'undefined') {
          (window as any).solana = okxSolana;
        }
        setOkxProvider(okxSolana);
      } catch (err) {
        console.warn("OKX init failed:", err);
      } finally {
        setLoading(false);
      }
    };
    initOKX();
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen text-white">Loading wallets...</div>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true} // 改 true：自动重连
        onError={(err) => console.error("Wallet error:", err)} // 捕获 err
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}