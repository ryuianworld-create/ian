import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { TopBar } from "@/components/TopBar";
import { TabBar } from "@/components/TabBar";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// 헤더의 통계(DAY N)는 요청마다 api 에서 읽는다. 정적 프리렌더에 박히지 않도록 전체를 동적으로 둔다.
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "HR 아티클 한 편", template: "%s · HR 아티클 한 편" },
  description:
    "매일 HR 아티클·논문 한 편을 한글·영문 요약으로 읽고, 본문에서 나온 단어를 그대로 단어장으로 넘겨 외우는 모바일 웹.",
  applicationName: "HR Daily",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-180.png", apple: "/icon-180.png" },
  appleWebApp: { capable: true, title: "HR 아티클", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Next 15 는 appleWebApp.capable 을 mobile-web-app-capable 로만 내보내므로 iOS 용 태그를 직접 추가한다.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#131418" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${newsreader.variable} ${notoSansKr.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>
          <TopBar />
          <div className="wrap">{children}</div>
          <TabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
