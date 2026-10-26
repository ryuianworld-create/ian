import { api } from "@/lib/api";
import type { StatsResponse } from "@/lib/types";
import { DesktopNav } from "./DesktopNav";
import { Brand } from "./Brand";

// 상단 헤더: 브랜드 + DAY N(= 아티클 수) + 요약 편수·단어 수. 공개 통계라 토큰이 필요 없다.
export async function TopBar() {
  let stats: StatsResponse | null = null;
  try {
    stats = await api.stats();
  } catch {
    stats = null;
  }
  return (
    <div className="topbar">
      <div className="topbar-in">
        <div className="brand">
          <Brand size="sm" />
          <span className="no">{stats ? `DAY ${stats.articles}` : "—"}</span>
        </div>
        <DesktopNav />
        <div className="streak">
          {stats ? (
            <>
              요약 <b>{stats.articles}</b>편 · 단어 <b>{stats.vocab}</b>
            </>
          ) : (
            "연결 대기 중"
          )}
        </div>
      </div>
    </div>
  );
}
