import type { Metadata } from "next";
import { AccountView } from "@/components/AccountView";

export const metadata: Metadata = { title: "내 정보" };

export default function AccountPage() {
  return (
    <div className="jr jr-page">
      <div className="jr-issue">
        <span className="eyebrow">Account</span>
      </div>
      <div className="jr-pagehead">
        <h1 className="jr-h1">내 정보</h1>
        <p className="jr-sub-line">이름과 메일 수신 여부를 바꿀 수 있습니다.</p>
      </div>
      <AccountView />
    </div>
  );
}
