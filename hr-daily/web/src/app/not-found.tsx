import Link from "next/link";

export default function NotFound() {
  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">404</span>
        <h2 className="sec">페이지를 찾을 수 없습니다</h2>
      </div>
      <p className="page-note">
        주소가 바뀌었거나 삭제된 글입니다. <Link href="/">오늘의 아티클로 돌아가기</Link>
      </p>
    </section>
  );
}
