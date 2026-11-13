"use client";

/**
 * The app's own sign-in session as the browser sees it: GET /api/me (the HttpOnly cookie, 7 days). It doesn't depend
 * on the wallet, so the header and the dashboard show who's signed in on every reload while the wallet reconnects in
 * the background. Refreshed when sign-in or sign-out happens (SESSION_EVENT).
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import type { MeResponse } from "../types";
import { SESSION_EVENT } from "./signin";

export type SessionState = { loading: true; me: null; error: null } | { loading: false; me: MeResponse | null; error: unknown };

export function useSessionAccount(): SessionState & { refresh: () => void } {
  const [state, setState] = useState<SessionState>({ loading: true, me: null, error: null });
  const [n, setN] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api<MeResponse>("/api/me")
      .then((me) => !cancelled && setState({ loading: false, me, error: null }))
      .catch((error) => !cancelled && setState({ loading: false, me: null, error }));
    return () => {
      cancelled = true;
    };
  }, [n]);
  useEffect(() => {
    const on = () => setN((x) => x + 1);
    window.addEventListener(SESSION_EVENT, on);
    return () => window.removeEventListener(SESSION_EVENT, on);
  }, []);
  return { ...state, refresh: () => setN((x) => x + 1) };
}
