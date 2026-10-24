// Vercel Functions 진입점. vercel.json 의 rewrite 로 모든 경로가 이 함수로 온다.
// Vercel 의 Node 런타임은 (req, res) 형태의 Node 요청을 넘기므로 Node 전용 어댑터를 쓴다.
// (hono/vercel 은 Web Request 전용이라 "this.raw.headers.get is not a function" 이 난다)
import { handle } from "@hono/node-server/vercel";
import app from "../src/app.js";

export default handle(app);
