"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

const TABS = [
  {
    href: "/",
    label: "오늘",
    match: (p: string) => p === "/" || p.startsWith("/a/"),
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M12 4h6.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H12" />
      </svg>
    ),
  },
  {
    href: "/vocab",
    label: "단어장",
    match: (p: string) => p.startsWith("/vocab"),
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 10h6M7 14h4" />
      </svg>
    ),
  },
  {
    href: "/library",
    label: "서재",
    match: (p: string) => p.startsWith("/library"),
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M5 4v16M9.5 4v16M14 5l4.5 15" />
        <path d="M3.5 20h17" />
      </svg>
    ),
  },
];

export function TabBar() {
  const pathname = usePathname() ?? "/";
  const { session, ready } = useAuth();
  const meHref = session ? "/account" : "/login";
  const meActive = ["/account", "/login", "/signup", "/pending", "/admin"].some((p) => pathname.startsWith(p));

  return (
    <nav className="tabbar">
      <div className="tabbar-in" role="tablist" aria-label="화면 전환">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="tab" role="tab" aria-selected={t.match(pathname)}>
            {t.icon}
            {t.label}
          </Link>
        ))}
        <Link href={meHref} className="tab" role="tab" aria-selected={meActive}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
          {ready && !session ? "로그인" : "내 정보"}
        </Link>
      </div>
    </nav>
  );
}
