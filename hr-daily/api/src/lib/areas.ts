// HR 분야 분류. 요약 단계에서 요약 모델이 글 전체를 읽고 이 목록에서 하나(필요하면 보조 하나)를 고른다.
// 제목 키워드가 아니라 본문 기준이라 논문·아티클 내용과 분류가 맞는다. 목록을 바꾸면 web/src/lib/areas.ts 도 같이 바꾼다.
export type Area =
  | "hiring" | "comp" | "performance" | "learning" | "leadership" | "culture"
  | "wellbeing" | "strategy" | "tech" | "labor" | "work" | "careers";

export const AREA_ORDER: readonly Area[] = [
  "hiring", "comp", "performance", "learning", "leadership", "culture", "wellbeing", "strategy", "tech", "labor", "work", "careers",
] as const;

export type AreaInfo = { id: Area; ko: string; en: string; desc: string };
export const AREAS: Record<Area, AreaInfo> = {
  hiring: { id: "hiring", ko: "채용·인재확보", en: "Talent Acquisition", desc: "recruiting, sourcing, selection & assessment, interviewing, employer branding, onboarding, new-hire experience" },
  comp: { id: "comp", ko: "보상·복리후생", en: "Compensation & Benefits", desc: "pay, salary structures, incentives & bonuses, equity, benefits, pay transparency & equity, total rewards" },
  performance: { id: "performance", ko: "성과관리", en: "Performance Management", desc: "goal setting (OKR/KPI), performance reviews, feedback, calibration, productivity measurement at the individual level" },
  learning: { id: "learning", ko: "학습·역량개발", en: "Learning & Development", desc: "training, upskilling/reskilling, skills frameworks, certifications and courses, HR professional development" },
  leadership: { id: "leadership", ko: "리더십·관리자", en: "Leadership & Managers", desc: "leadership development, manager behavior and effectiveness, executive and succession topics" },
  culture: { id: "culture", ko: "조직문화·몰입", en: "Culture & Engagement", desc: "organizational culture, engagement, voice and silence, trust, teamwork, organizational behavior in general" },
  wellbeing: { id: "wellbeing", ko: "웰빙·다양성·포용", en: "Wellbeing, DEI", desc: "employee wellbeing, burnout, stress, mental health, diversity, equity & inclusion, belonging, gender and bias" },
  strategy: { id: "strategy", ko: "HR전략·조직설계", en: "HR Strategy & Org Design", desc: "HR strategy, HR operating model and HR function design, organizational design, workforce planning, HR budgeting, HRM theory and research methods" },
  tech: { id: "tech", ko: "HR테크·피플 애널리틱스", en: "HR Tech & People Analytics", desc: "HR technology and HCM systems, AI in HR, automation, people analytics and HR data" },
  labor: { id: "labor", ko: "노사관계·근로조건·제도", en: "Employee Relations & Policy", desc: "labor law and compliance, unions and employee representation, leave policies (parental, sick), working hours, employment contracts, public policy" },
  work: { id: "work", ko: "일하는 방식·미래의 일", en: "Work Design & Future of Work", desc: "remote and hybrid work, job design, work-life boundaries, gig and flexible work, how AI and automation change jobs" },
  careers: { id: "careers", ko: "경력·이동·리텐션", en: "Careers, Mobility & Retention", desc: "career development, internal mobility, promotion, turnover and retention, job embeddedness, offboarding" },
};

export function isArea(s: unknown): s is Area {
  return typeof s === "string" && (AREA_ORDER as readonly string[]).includes(s);
}

export function areaLabel(a: Area | null | undefined): string | null {
  return a ? AREAS[a].ko : null;
}
