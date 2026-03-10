import type { Metadata } from "next";

import { APP_NAME } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "신혼부부 아파트 매수 준비를 위한 종합 재정 플래너",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
