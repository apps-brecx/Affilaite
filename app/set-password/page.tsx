import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { BrandScope } from "@/components/marketing/brand-scope";
import { getBrand } from "@/lib/queries";
import { auth } from "@/lib/auth";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const [brand, session] = await Promise.all([getBrand(), auth()]);
  const user = session?.user as any;
  if (!user) redirect("/login");

  const home = user.role === "admin" ? "/admin" : "/dashboard";
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
            <Logo className="mb-6" text={brand.logoText} />
            <h1 className="font-display text-2xl font-semibold tracking-tight">Set your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              You signed in with a temporary code. Choose a password to secure your account before you continue.
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <SetPasswordForm email={user.email ?? ""} home={home} />
            </CardContent>
          </Card>
        </div>
      </div>
    </BrandScope>
  );
}
