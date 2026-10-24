import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = { title: "승인 대기" };

export default function PendingPage() {
  return (
    <AuthShell eyebrow="Pending approval" title="승인을 기다리고 있습니다">
      <div className="banner pending" role="status" style={{ marginTop: 6 }}>
        <span>
          가입 요청을 받았습니다. 관리자가 확인한 뒤 승인하면 <b>메일로 알려드립니다</b>. 승인 후에는 지난 호 전체와 매일
          아침 7시 메일을 받을 수 있습니다.
        </span>
      </div>
      <p className="jr-cardintro" style={{ marginTop: 14 }}>
        그동안에도 최신 호는 읽을 수 있고, 단어장에서 외운 단어는 계정에 저장됩니다.
      </p>
      <div className="jr-actions" style={{ marginTop: 8 }}>
        <Link href="/" className="btn primary">
          오늘의 호 읽기
        </Link>
        <Link href="/account" className="btn">
          내 정보
        </Link>
      </div>
    </AuthShell>
  );
}
