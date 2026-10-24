"use client";
// 데스크톱(≥900px) 상단 내비게이션. 모바일에서는 하단 탭바가 같은 역할을 한다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const LINKS = [
  { href: "/", label: "오늘", match: (p: string) => p === "/" || p.startsWith("/a/") },
  { href: "/vocab", label: "단어장", match: (p: string) => p.startsWith("/vocab") },
  { href: "/library", label: "서재", match: (p: string) => p.startsWith("/library") },
];

export function DesktopNav() {
  const pathname = usePathname() ?? "/";
  const { session, ready } = useAuth();
  const meHref = session ? "/account" : "/login";
  const meActive = ["/account", "/login", "/signup", "/pending", "/admin"].some((p) => pathname.startsWith(p));
  return (
    <nav className="dnav" aria-label="주요 메뉴">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.match(pathname) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
      <Link href={meHref} aria-current={meActive ? "page" : undefined} className="me">
        {ready && !session ? "로그인" : "내 정보"}
      </Link>
    </nav>
  );
}
