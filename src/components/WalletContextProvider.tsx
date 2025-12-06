"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { OKXSolanaProvider } from "@okxconnect/solana-provider";
import { OKXUniversalProvider } from "@okxconnect/universal-provider";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import { useMemo, useEffect, useState } from "react";

export default function WalletContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const [okxProvider, setOkxProvider] = useState<any>(null);

  useEffect(() => {
    const initOKX = async () => {
      const universalProvider = await OKXUniversalProvider.init({
        dappMetaData: {
          name: "MGT Lunar Legacy",
          icon: "https://your-icon-url.com/icon.png",
        },
      });
      const okxSolana = new OKXSolanaProvider(universalProvider);
      setOkxProvider(okxSolana);
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

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {okxProvider ? <OKXProviderContext.Provider value={okxProvider}>{children}</OKXProviderContext.Provider> : children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

const OKXProviderContext = React.createContext(null);
