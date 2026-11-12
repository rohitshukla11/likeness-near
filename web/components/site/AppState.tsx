"use client";

/** Every app page: the dark header (destinations and the NEAR wallet), then the page. */
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { WalletButton } from "./WalletButton";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="bg-ink text-white">
        <AppHeader account={<WalletButton />} />
      </div>
      {children}
    </>
  );
}
