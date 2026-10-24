// 홈(저널) 화면 전용 헬퍼. 날짜 표기와 출처 소개.
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-10-24" → "2026년 10월 24일 금요일" */
export function longDateKo(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  const w = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${y}년 ${m}월 ${day}일 ${w}요일`;
}

/** "2026-10-24" → "Oct 24, 2026" */
export function longDateEn(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export type SourceInfo = { name: string; kind: "paper" | "article"; desc: string; home: string };

/** 수집 소스 소개 (api 의 sources 시드와 같은 순서·이름) */
export const SOURCES: SourceInfo[] = [
  { name: "Human Resource Management", kind: "paper", desc: "Wiley · HR 분야 최상위 학술지. 전략적 HRM·인재관리 실증 연구", home: "https://onlinelibrary.wiley.com/journal/1099050x" },
  { name: "Human Resource Management Journal", kind: "paper", desc: "Wiley · 영국 기반 HRM 저널. 노동·고용관계와 HR 실천의 접점", home: "https://onlinelibrary.wiley.com/journal/17488583" },
  { name: "Journal of Organizational Behavior", kind: "paper", desc: "Wiley · 조직행동 연구. 몰입·리더십·팀·웰빙", home: "https://onlinelibrary.wiley.com/journal/10991379" },
  { name: "AIHR", kind: "article", desc: "Academy to Innovate HR · 실무 가이드와 템플릿, HR 트렌드", home: "https://www.aihr.com/" },
  { name: "Josh Bersin", kind: "article", desc: "HR 테크·인재 전략 분석가의 리서치 노트", home: "https://joshbersin.com/" },
  { name: "McKinsey Insights", kind: "article", desc: "People & Organization 관련 보고서만 선별", home: "https://www.mckinsey.com/" },
];
