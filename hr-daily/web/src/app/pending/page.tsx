import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "승인 대기" };

export default function PendingPage() {
  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">Pending approval</span>
        <h2 className="sec">승인을 기다리고 있습니다</h2>
      </div>
      <div className="banner pending" role="status">
        <span>
          가입 요청을 받았습니다. 관리자가 확인한 뒤 승인하면 <b>메일로 알려드립니다</b>. 승인 후에는 지난 아티클 전체와
          매일 아침 7시 메일을 받을 수 있습니다.
        </span>
      </div>
      <p className="page-note">
        그동안에도 최신 아티클은 읽을 수 있고, 단어장에서 외운 단어는 계정에 저장됩니다.
      </p>
      <div className="cta" style={{ marginTop: 18 }}>
        <div className="row">
          <Link href="/" className="btn primary">
            오늘의 아티클 읽기
          </Link>
          <Link href="/account" className="btn">
            내 정보
          </Link>
        </div>
      </div>
    </section>
  );
}
