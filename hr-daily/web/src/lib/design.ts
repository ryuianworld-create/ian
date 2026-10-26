// 디자인 A/B 비교용 스위치. 쿠키 dhr_design = "a" | "b". 기본은 A(저널 톤).
// ?design=b 로 들어오면 미들웨어가 쿠키를 심고 같은 경로로 돌려보낸다.
import { cookies } from "next/headers";
import { DESIGN_COOKIE, parseDesign, type Design } from "./design-cookie";

export type { Design } from "./design-cookie";
export { DESIGN_COOKIE } from "./design-cookie";

export async function getDesign(): Promise<Design> {
  const jar = await cookies();
  return parseDesign(jar.get(DESIGN_COOKIE)?.value);
}
