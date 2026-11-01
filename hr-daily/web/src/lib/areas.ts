// HR 분야 분류 (api/src/lib/areas.ts 와 같은 목록). 배지 색은 여기서만 쓴다.
export type Area =
  | "hiring" | "comp" | "performance" | "learning" | "leadership" | "culture"
  | "wellbeing" | "strategy" | "tech" | "labor" | "work" | "careers";

export const AREA_ORDER: readonly Area[] = [
  "hiring", "comp", "performance", "learning", "leadership", "culture", "wellbeing", "strategy", "tech", "labor", "work", "careers",
] as const;

export type AreaInfo = { id: Area; ko: string; en: string; color: string; soft: string };
export const AREAS: Record<Area, AreaInfo> = {
  hiring: { id: "hiring", ko: "채용·인재확보", en: "Talent Acquisition", color: "#B45309", soft: "#FDEBD6" },
  comp: { id: "comp", ko: "보상·복리후생", en: "Compensation & Benefits", color: "#0369A1", soft: "#E0F2FE" },
  performance: { id: "performance", ko: "성과관리", en: "Performance Management", color: "#92400E", soft: "#FEF3C7" },
  learning: { id: "learning", ko: "학습·역량개발", en: "Learning & Development", color: "#166534", soft: "#DCFCE7" },
  leadership: { id: "leadership", ko: "리더십·관리자", en: "Leadership & Managers", color: "#5B21B6", soft: "#EDE9FE" },
  culture: { id: "culture", ko: "조직문화·몰입", en: "Culture & Engagement", color: "#9D174D", soft: "#FCE7F3" },
  wellbeing: { id: "wellbeing", ko: "웰빙·다양성·포용", en: "Wellbeing, DEI", color: "#0F766E", soft: "#CCFBF1" },
  strategy: { id: "strategy", ko: "HR전략·조직설계", en: "HR Strategy & Org Design", color: "#1E293B", soft: "#E2E8F0" },
  tech: { id: "tech", ko: "HR테크·피플 애널리틱스", en: "HR Tech & People Analytics", color: "#1D4ED8", soft: "#DBEAFE" },
  labor: { id: "labor", ko: "노사관계·근로조건·제도", en: "Employee Relations & Policy", color: "#991B1B", soft: "#FEE2E2" },
  work: { id: "work", ko: "일하는 방식·미래의 일", en: "Work Design & Future of Work", color: "#854D0E", soft: "#FEF9C3" },
  careers: { id: "careers", ko: "경력·이동·리텐션", en: "Careers, Mobility & Retention", color: "#9A3412", soft: "#FFEDD5" },
};

export function isArea(s: unknown): s is Area {
  return typeof s === "string" && (AREA_ORDER as readonly string[]).includes(s);
}
