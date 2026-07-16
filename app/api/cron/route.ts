import { approveMaturedCommissions } from "@/lib/commissions";

// Render Cron hits this daily to mature commissions past their hold window.
// Protect with a shared secret so only your scheduler can trigger it.
export async function GET(req: Request) {
  // Fail closed: a missing secret must NOT leave the endpoint open (it can
  // approve commissions), so require it to be configured and to match.
  if (!process.env.CRON_SECRET) {
    return new Response("cron secret not configured", { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await approveMaturedCommissions();
  return Response.json({ ok: true, ...result });
}
