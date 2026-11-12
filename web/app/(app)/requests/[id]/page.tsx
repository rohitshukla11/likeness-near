"use client";

import { useParams } from "next/navigation";
import { RequestPage } from "@/components/likeness/RequestPage";

/** One ad for the signed-in creator, by its sha256: the exact file, then Approve or Reject in their wallet. */
export default function RequestById() {
  const { id } = useParams<{ id: string }>();
  return <RequestPage sha256={id.toLowerCase()} />;
}
