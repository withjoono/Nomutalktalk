import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://legaltech-490706.web.app"),
  title: "Legal Tech - AI 법률 컨설턴트",
  description: "언제 어디서나 내 손안의 AI 법률 전문가, Legal Tech. 사건 입력부터 판례 분석, 법령 검색까지 한번에.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Legal Tech - AI 법률 컨설턴트",
    description: "언제 어디서나 내 손안의 AI 법률 전문가, Legal Tech. 사건 입력부터 판례 분석, 법령 검색까지 한번에.",
    url: "https://legaltech-490706.web.app",
    siteName: "Legal Tech",
    images: [
      {
        url: "/og-image.png",
        width: 512,
        height: 512,
        alt: "Legal Tech 로고",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Legal Tech - AI 법률 컨설턴트",
    description: "언제 어디서나 내 손안의 AI 법률 전문가, Legal Tech",
    images: ["/og-image.png"],
  },
};

import { AuthProvider } from "@/context/AuthContext";
import { CaseFlowProvider } from "@/context/CaseFlowContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <CaseFlowProvider>
            <AppShell>
              {children}
            </AppShell>
          </CaseFlowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
