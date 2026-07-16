import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { BrandScope } from "@/components/marketing/brand-scope";
import { getBrand } from "@/lib/queries";

export const metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const brand = await getBrand();
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
            <h1 className="font-display text-2xl font-semibold tracking-tight">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll send you a reset link.</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <Suspense>
                <ForgotPasswordForm />
              </Suspense>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
              <ArrowLeft className="size-3.5" /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </BrandScope>
  );
}
