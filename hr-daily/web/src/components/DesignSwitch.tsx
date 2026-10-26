"use client";
// 화면 구석의 A/B 디자인 전환 스위치 (비교 기간에만 노출). 일반 <a> 로 두어 미들웨어가 쿠키를 바꾸게 한다.
import { usePathname } from "next/navigation";
import type { Design } from "@/lib/design-cookie";

export function DesignSwitch({ design }: { design: Design }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="ld-switch" role="group" aria-label="디자인 비교">
      <span className="lbl">디자인</span>
      {(["a", "b"] as const).map((d) => (
        <a key={d} href={`${pathname}?design=${d}`} aria-current={design === d ? "true" : undefined}>
          {d.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
