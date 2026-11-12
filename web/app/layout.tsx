import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Likeness",
  description: "License your face to AI ads. Only you approve each ad, and you're paid per render on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
