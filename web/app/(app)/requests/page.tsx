"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Where a link without an ad lands: the creator's ads live on the dashboard. */
export default function Requests() {
  const router = useRouter();
  useEffect(() => router.replace("/dashboard"), [router]);
  return null;
}
