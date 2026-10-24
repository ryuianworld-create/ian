import type { Metadata } from "next";
import { AdminView } from "@/components/AdminView";

export const metadata: Metadata = { title: "관리자" };

export default function AdminPage() {
  return (
    <section>
      <div className="sec-head" style={{ marginTop: 20 }}>
        <span className="eyebrow">Admin</span>
        <h2 className="sec">관리자</h2>
      </div>
      <AdminView />
    </section>
  );
}
