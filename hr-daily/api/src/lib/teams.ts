// HR 팀 분류와 고양이 당번. 하루씩 돌아가며 한 팀(고양이)이 당번이 되어 그날의 글을 고르고 보낸다.
//  ta=TA팀 에옹이 · ops=HR운영팀 츄르정 · strategy=HR전략팀 캣브레인 · culture=인재성장문화팀 꾹꾹이
import { daysBetween } from "./kst.js";

export type Team = "ta" | "ops" | "strategy" | "culture";
export const TEAM_ORDER: readonly Team[] = ["ta", "ops", "strategy", "culture"] as const;
export const DUTY_ANCHOR = "2026-10-27"; // 이 날이 TA팀 당번. 이후 하루씩 TEAM_ORDER 순서로 돈다

export type TeamInfo = { id: Team; team: string; cat: string; role: string; color: string; avatar: string };
export const TEAMS: Record<Team, TeamInfo> = {
  ta: { id: "ta", team: "TA팀", cat: "에옹이 사원", role: "인재 소싱·영입 담당", color: "#F2A65A", avatar: "/cats/ta.png" },
  ops: { id: "ops", team: "HR운영팀", cat: "츄르정 사원", role: "조직 운영·규정 담당", color: "#8E3B4C", avatar: "/cats/ops.png" },
  strategy: { id: "strategy", team: "HR전략팀", cat: "캣브레인 사원", role: "근태·전략 기획 담당", color: "#3C5A8A", avatar: "/cats/strategy.png" },
  culture: { id: "culture", team: "인재성장문화팀", cat: "꾹꾹이 사원", role: "조직문화·성장 담당", color: "#6B8E4E", avatar: "/cats/culture.png" },
};

export function isTeam(s: unknown): s is Team {
  return typeof s === "string" && (TEAM_ORDER as readonly string[]).includes(s);
}

/** 날짜(YYYY-MM-DD, KST)의 당번 팀 */
export function dutyTeam(date: string): Team {
  const i = ((daysBetween(date, DUTY_ANCHOR) % 4) + 4) % 4;
  return TEAM_ORDER[i] ?? "ta";
}

// 제목·카테고리 키워드로 팀을 추정한다 (수집 후보 고르기용. 최종 분류는 요약 단계에서 Gemini 가 한다)
const KEYWORDS: Record<Team, string[]> = {
  ta: ["recruit", "hiring", "hire", "talent acquisition", "sourcing", "candidate", "interview", "employer brand", "onboarding", "applicant", "selection", "job posting", "résumé", "resume", "assessment"],
  ops: ["compensation", "salary", "pay", "payroll", "benefit", "policy", "policies", "compliance", "labor law", "labour law", "employment law", "union", "regulation", "leave", "hcm", "hris", "hr tech", "workday", "sap", "oracle", "operations", "overtime", "working hours"],
  strategy: ["strategy", "strategic", "workforce planning", "analytics", "data-driven", "operating model", "transformation", "productivity", "organizational design", "organisational design", "future of work", "planning", "attendance", "hybrid", "remote", "ai", "business partner", "performance"],
  culture: ["culture", "engagement", "learning", "development", "training", "course", "skill", "skills", "upskilling", "leadership", "coaching", "career", "wellbeing", "well-being", "burnout", "psychological safety", "inclusion", "belonging", "recognition", "retention", "motivation", "mentoring", "communication"],
};

function hasWord(text: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(text);
}

/** 가장 많은 키워드가 걸린 팀. 아무것도 안 걸리면 null */
export function classifyTeam(title: string, category?: string | null): Team | null {
  const text = `${title} ${category ?? ""}`;
  let best: Team | null = null;
  let bestN = 0;
  for (const t of TEAM_ORDER) {
    const n = KEYWORDS[t].filter((k) => hasWord(text, k)).length;
    if (n > bestN) { best = t; bestN = n; }
  }
  return best;
}
