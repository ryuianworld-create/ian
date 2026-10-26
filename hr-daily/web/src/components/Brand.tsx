// DailyHR 워드마크. 부엉이 마크 + "Daily"(남색) + "HR"(금빛 노랑), Poppins 800.
import Image from "next/image";
import Link from "next/link";
import owl from "../../public/logo-owl-160.png";

export function BrandMark({ size = 28 }: { size?: number }) {
  return <Image src={owl} alt="" width={size} height={size} className="wm-mark" priority />;
}

export function Brand({ href = "/", size = "md", tagline }: { href?: string; size?: "sm" | "md" | "lg"; tagline?: string }) {
  const px = size === "lg" ? 48 : size === "sm" ? 30 : 36;
  return (
    <Link href={href} className={`wm wm-${size}`} aria-label="DailyHR 홈">
      <BrandMark size={px} />
      <span className="wm-text">
        <span className="wm-word">
          Daily<b>HR</b>
        </span>
        {tagline ? <span className="wm-tag">{tagline}</span> : null}
      </span>
    </Link>
  );
}
