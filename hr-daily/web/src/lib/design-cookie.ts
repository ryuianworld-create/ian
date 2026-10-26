// 미들웨어(엣지)와 서버 컴포넌트가 함께 쓰는 상수. next/headers 를 끌어오지 않도록 분리.
export type Design = "a" | "b";
export const DESIGN_COOKIE = "dhr_design";
export function parseDesign(v: string | null | undefined): Design {
  return v === "b" ? "b" : "a";
}
