// Vercel Functions 진입점. vercel.json 의 rewrite 로 모든 경로가 이 함수로 온다.
// Node 런타임(Anthropic·Resend SDK 가 Node API 를 쓴다). hono/vercel 은 Web Request 핸들러를 돌려준다.
import { handle } from "hono/vercel";
import app from "../src/app";

export default handle(app);
