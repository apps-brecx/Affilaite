import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="relative">
        <Logo className="mx-auto mb-8" />
        <p className="font-display text-8xl font-semibold tracking-tight text-primary/20">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist or has moved.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link href="/">Back home</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/dashboard">Go to portal</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
