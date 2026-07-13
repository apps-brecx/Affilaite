import { approveMaturedCommissions } from "@/lib/commissions";

// Render Cron hits this daily to mature commissions past their hold window.
// Protect with a shared secret so only your scheduler can trigger it.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await approveMaturedCommissions();
  return Response.json({ ok: true, ...result });
}
