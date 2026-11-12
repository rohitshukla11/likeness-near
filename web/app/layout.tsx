import type { Metadata } from "next";
import { Poppins, Unbounded } from "next/font/google";
import { SiteFooter } from "@/components/site/SiteFooter";
import { WalletProvider } from "@/lib/near/wallet";
import "./globals.css";

const display = Unbounded({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display-face", display: "swap" });
const body = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body-face", display: "swap" });

const TAGLINE = "License your face to AI. Only you approve each ad.";
const DESCRIPTION = `${TAGLINE} A brand's AI agent proposes ads within your terms; you approve every licence and every ad, and you're paid per render from the brand's escrow on NEAR.`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: { default: `Likeness: ${TAGLINE}`, template: "%s · Likeness" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "Likeness", title: `Likeness: ${TAGLINE}`, description: DESCRIPTION },
  twitter: { card: "summary", title: `Likeness: ${TAGLINE}`, description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-ink font-sans text-ink">
        <a href="#main" className="sr-only z-50 rounded-full bg-lime px-5 py-3 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
          Skip to content
        </a>
        <WalletProvider>
          {children}
          <SiteFooter />
        </WalletProvider>
      </body>
    </html>
  );
}
