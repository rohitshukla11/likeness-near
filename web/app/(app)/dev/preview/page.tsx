import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Preview } from "./Preview";

/** Local development only: the dashboards rendered with TEST DATA, for review and screenshots. 404 in production. */
export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
