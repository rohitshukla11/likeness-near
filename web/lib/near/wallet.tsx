"use client";

/**
 * The browser-side NEAR wallet (near-connect, testnet). It holds which account is connected and signs what the
 * person confirms in their own wallet: contract calls, and plain actions (AddKey/DeleteKey for the agent key). No
 * key ever reaches this app: the wallet signs inside its own sandboxed frame.
 */
import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CONTRACT_ID, NETWORK } from "./config";
import type { ContractCall } from "./methods";

/** The actions this app ever asks a wallet to sign (near-connect's ConnectorAction subset). */
export type WalletAction =
  | { type: "FunctionCall"; params: { methodName: string; args: object; gas: string; deposit: string } }
  | { type: "AddKey"; params: { publicKey: string; accessKey: { permission: { receiverId: string; allowance?: string; methodNames?: string[] } } } }
  | { type: "DeleteKey"; params: { publicKey: string } };

export interface TxResult {
  hash: string | null;
  /** The contract's return value, if it returned one (base64-decoded JSON). */
  value: unknown;
}

interface WalletState {
  /** False until the connector has loaded and restored any earlier connection. */
  ready: boolean;
  accountId: string | null;
  walletName: string | null;
  error: string | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** A call to the Likeness contract, signed in the wallet. Throws if the contract isn't configured. */
  call(c: ContractCall): Promise<TxResult>;
  /** Any actions on any receiver (used for AddKey/DeleteKey on the person's own account). */
  send(receiverId: string, actions: WalletAction[]): Promise<TxResult>;
  /** NEP-413 signed message (sign-in to our API). */
  signMessage(message: string, recipient: string, nonce: Uint8Array): Promise<{ accountId: string; publicKey: string; signature: string }>;
}

const Ctx = createContext<WalletState | null>(null);

type Outcome = { transaction?: { hash?: string }; transaction_outcome?: { id?: string }; status?: { SuccessValue?: string; Failure?: unknown } };

function readOutcome(o: unknown): TxResult {
  const x = (o ?? {}) as Outcome;
  if (x.status && "Failure" in x.status && x.status.Failure) throw new Error(`the transaction failed: ${JSON.stringify(x.status.Failure).slice(0, 300)}`);
  const raw = x.status?.SuccessValue;
  let value: unknown = null;
  if (raw) {
    try {
      value = JSON.parse(atob(raw));
    } catch {
      value = null;
    }
  }
  return { hash: x.transaction?.hash ?? x.transaction_outcome?.id ?? null, value };
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const connector = useRef<NearConnector | null>(null);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { NearConnector } = await import("@hot-labs/near-connect");
        if (cancelled) return;
        const c = new NearConnector({ network: NETWORK, autoConnect: true });
        connector.current = c;
        c.on("wallet:signIn", (e) => {
          setAccountId(e.accounts[0]?.accountId ?? null);
          setWalletName(e.wallet.manifest.name);
        });
        c.on("wallet:signOut", () => {
          setAccountId(null);
          setWalletName(null);
        });
        try {
          const { wallet, accounts } = await c.getConnectedWallet();
          if (!cancelled) {
            setAccountId(accounts[0]?.accountId ?? null);
            setWalletName(wallet.manifest.name);
          }
        } catch {
          // nothing connected yet
        }
      } catch (e) {
        if (!cancelled) setError(`The wallet selector couldn't load: ${(e as Error).message}`);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      connector.current?.removeAllListeners();
    };
  }, []);

  const wallet = useCallback(async (): Promise<NearWalletBase> => {
    if (!connector.current) throw new Error("the wallet selector isn't ready yet");
    return connector.current.wallet();
  }, []);

  const send = useCallback(
    async (receiverId: string, actions: WalletAction[]) => {
      const w = await wallet();
      const out = await w.signAndSendTransaction({ network: NETWORK, signerId: accountId ?? undefined, receiverId, actions });
      return readOutcome(out);
    },
    [wallet, accountId],
  );

  const value = useMemo<WalletState>(
    () => ({
      ready,
      accountId,
      walletName,
      error,
      async connect() {
        setError(null);
        if (!connector.current) throw new Error("the wallet selector isn't ready yet");
        await connector.current.connect();
      },
      async disconnect() {
        await connector.current?.disconnect();
        setAccountId(null);
        setWalletName(null);
      },
      async call(c) {
        if (!CONTRACT_ID) throw new ContractNotConfigured();
        return send(CONTRACT_ID, [{ type: "FunctionCall", params: { methodName: c.method, args: c.args, gas: c.gas, deposit: c.deposit } }]);
      },
      send,
      async signMessage(message, recipient, nonce) {
        const w = await wallet();
        return w.signMessage({ message, recipient, nonce, network: NETWORK, signerId: accountId ?? undefined });
      },
    }),
    [ready, accountId, walletName, error, send, wallet],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export class ContractNotConfigured extends Error {
  constructor() {
    super("The Likeness contract isn't connected in this build yet (no contract id).");
  }
}

export function useWallet(): WalletState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}
