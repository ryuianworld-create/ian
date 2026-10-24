import type { Metadata } from "next";
import { AccountView } from "@/components/AccountView";

export const metadata: Metadata = { title: "내 정보" };

export default function AccountPage() {
  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">Account</span>
        <h2 className="sec">내 정보</h2>
      </div>
      <AccountView />
    </section>
  );
}
