import type { Metadata } from "next";
import { AdminView } from "@/components/AdminView";

export const metadata: Metadata = { title: "관리자" };

export default function AdminPage() {
  return (
    <div className="jr jr-page">
      <div className="jr-issue">
        <span className="eyebrow">Admin</span>
      </div>
      <div className="jr-pagehead">
        <h1 className="jr-h1">관리자</h1>
        <p className="jr-sub-line">가입 승인, 수집·요약·발송 즉시 실행, 대기열과 실행 기록을 봅니다.</p>
      </div>
      <AdminView />
    </div>
  );
}
