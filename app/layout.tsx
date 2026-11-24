import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConsentAwareFooter } from "@/components/ConsentAwareFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RunPilot",
  description: "몸에 무리가 가지 않는 러닝 훈련계획과 대회 준비를 돕는 참고용 가이드",
};

// Design Ref: §5.2 공통 — 머리글(위) · 내용(가운데) · 안내 문구(맨 아래)를 모든 화면에 적용한다.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <ConsentAwareFooter />
      </body>
    </html>
  );
}
