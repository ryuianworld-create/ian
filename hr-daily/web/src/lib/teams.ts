// HR 팀 분류와 고양이 당번 (api/src/lib/teams.ts 와 같은 규칙).
export type Team = "ta" | "ops" | "strategy" | "culture";
export const TEAM_ORDER: readonly Team[] = ["ta", "ops", "strategy", "culture"] as const;
const DUTY_ANCHOR = "2026-10-27"; // 이 날이 TA팀 당번. 하루씩 TEAM_ORDER 순서로 돈다

export type TeamInfo = { id: Team; team: string; cat: string; role: string; color: string; soft: string; avatar: string };
export const TEAMS: Record<Team, TeamInfo> = {
  ta: { id: "ta", team: "TA팀", cat: "에옹이 사원", role: "인재 소싱·영입 담당", color: "#F2A65A", soft: "#FDEBD6", avatar: "/cats/ta.png" },
  ops: { id: "ops", team: "HR운영팀", cat: "츄르정 사원", role: "조직 운영·규정 담당", color: "#8E3B4C", soft: "#F3DEE3", avatar: "/cats/ops.png" },
  strategy: { id: "strategy", team: "HR전략팀", cat: "캣브레인 사원", role: "근태·전략 기획 담당", color: "#3C5A8A", soft: "#DDE6F3", avatar: "/cats/strategy.png" },
  culture: { id: "culture", team: "인재성장문화팀", cat: "꾹꾹이 사원", role: "조직문화·성장 담당", color: "#6B8E4E", soft: "#E3EDDA", avatar: "/cats/culture.png" },
};

export function isTeam(s: unknown): s is Team {
  return typeof s === "string" && (TEAM_ORDER as readonly string[]).includes(s);
}

export function dutyTeam(date: string): Team {
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(DUTY_ANCHOR + "T00:00:00Z")) / 86_400_000);
  return TEAM_ORDER[((days % 4) + 4) % 4];
}
