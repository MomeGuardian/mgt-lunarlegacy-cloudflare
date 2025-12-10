import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WalletContextProvider from "@/components/WalletContextProvider";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Toaster } from "react-hot-toast";
import { Suspense } from "react";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://mgt-lunarlegacy.vercel.app'),
  title: "$MGT 直推军团 | 5% 返现 + 自动分账",
  description: "Solana 链上最强地推模式。连接钱包，绑定关系，实时领取 5% 交易税返现！",
  openGraph: {
    title: "$MGT 直推军团 | 5% 返现",
    description: "连接钱包，开启躺赚模式 🚀",
    images: ['/Solana.png'],
  },

  icons: {
    icon: '/Solana.png',
    shortcut: '/Solana.png',
    apple: '/Solana.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="wallet-connection" content="okxwallet" />
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                try {
                  if (window.okxwallet) {
                    window.solana = window.okxwallet;
                    if (!window.okxwallet.isOKX) window.okxwallet.isOKX = true;
                  }
                  if (window.solana && window.solana.isPhantom) console.log("Phantom detected");
                } catch (e) { console.warn("Wallet patch error:", e); }
              }
            `,
          }}
        />
      </head>

      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <Script src="https://terminal.jup.ag/main-v2.js" strategy="beforeInteractive" />

        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading app...</div>}>
          <WalletContextProvider>
            {children}
          </WalletContextProvider>
        </Suspense>

        <Toaster
          position="top-right"
          toastOptions={{
            style: { 
              background: '#1f2937', 
              color: '#fff', 
              border: '1px solid #9333ea'
            },
            duration: 3000,
          }}
        />
      </body>
    </html>
  );
}