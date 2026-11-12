"use client";

/** Every app page: the dark header (destinations, the NEAR account and its Creator | Brand switch), then the page. */
import { Suspense, type ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { AccountMenu } from "./AccountMenu";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="bg-ink text-white">
        <AppHeader
          account={
            <Suspense fallback={null}>
              <AccountMenu />
            </Suspense>
          }
        />
      </div>
      {children}
    </>
  );
}
