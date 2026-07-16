import { redirect } from "next/navigation";
import { Clock, ShieldAlert, XCircle } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { SignOutLink } from "@/components/auth/sign-out-link";
import { currentUser } from "@/lib/session";
import { getAffiliate } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account status" };

const STATES: Record<string, { icon: any; title: string; body: string }> = {
  pending: {
    icon: Clock,
    title: "Your application is under review",
    body: "Thanks for applying! We're reviewing your details and you'll get an email the moment you're approved. You'll be able to sign in and grab your link and code then.",
  },
  suspended: {
    icon: ShieldAlert,
    title: "Your account is paused",
    body: "Your partner account has been suspended. If you think this is a mistake, reply to any Sipfluence email and we'll take a look.",
  },
  rejected: {
    icon: XCircle,
    title: "Application not approved",
    body: "Thanks for your interest. We're not able to approve your application right now — you're welcome to reach out if you have questions.",
  },
};

export default async function PendingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const affiliateId = (user as any).affiliateId as string | null;
  const affiliate = affiliateId ? await getAffiliate(affiliateId) : null;
  if (affiliate?.status === "approved") redirect("/dashboard");

  const state = STATES[affiliate?.status ?? "pending"] ?? STATES.pending;
  const Icon = state.icon;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-8"><Logo /></div>
      <span className="mb-5 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-8" />
      </span>
      <h1 className="max-w-md font-display text-2xl font-semibold tracking-tight">{state.title}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{state.body}</p>
      <div className="mt-8"><SignOutLink /></div>
    </div>
  );
}
