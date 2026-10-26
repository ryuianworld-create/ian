// dailyHR 워드마크. 노란 사각 마크 + "daily"(잉크) + "HR"(브랜드 옐로).
import Link from "next/link";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="wm-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <path d="M22 44V20h7v9.2a9 9 0 1 1 0 14.8V44h-7Zm11-9.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" fill="var(--brand-ink)" />
      <circle cx="46" cy="20" r="4" fill="var(--brand-ink)" />
    </svg>
  );
}

export function Brand({ href = "/", size = "md", tagline }: { href?: string; size?: "sm" | "md" | "lg"; tagline?: string }) {
  const px = size === "lg" ? 40 : size === "sm" ? 22 : 28;
  return (
    <Link href={href} className={`wm wm-${size}`} aria-label="dailyHR 홈">
      <BrandMark size={px} />
      <span className="wm-text">
        <span className="wm-word">
          daily<b>HR</b>
        </span>
        {tagline ? <span className="wm-tag">{tagline}</span> : null}
      </span>
    </Link>
  );
}
