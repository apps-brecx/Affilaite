import Link from "next/link";
import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { BrandScope } from "@/components/marketing/brand-scope";
import { getBrand } from "@/lib/queries";
import { getTeamInviteEmail } from "@/lib/email-center";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [brand, { welcome }] = await Promise.all([getBrand(), searchParams]);
  // Invited members arrive with ?welcome=1 and get the custom greeting.
  const invited = welcome === "1";
  const invite = invited ? await getTeamInviteEmail() : null;
  const headline = invite?.loginHeadline?.trim() || (invited ? "Welcome" : "Welcome back");
  const subtext = invite?.loginSubtext?.trim() || `Sign in to the ${brand.logoText} partner portal.`;
  return (
    <BrandScope brand={brand}>
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo href="/" className="mb-6" text={brand.logoText} />
          <h1 className="font-display text-2xl font-semibold tracking-tight">{headline}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtext}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New partner?{" "}
          <Link href="/apply" className="font-medium text-primary hover:underline">
            Apply to join
          </Link>
        </p>
      </div>
    </div>
    </BrandScope>
  );
}
