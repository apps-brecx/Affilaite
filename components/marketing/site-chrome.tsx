import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">Features</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#numbers" className="transition-colors hover:text-foreground">Results</a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/apply">Become a partner</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
        </div>
        <p>© 2026 Affilaite. Built for modern Shopify brands.</p>
        <div className="flex gap-6">
          <Link href="/admin" className="transition-colors hover:text-foreground">Admin</Link>
          <Link href="/dashboard" className="transition-colors hover:text-foreground">Portal</Link>
          <Link href="/apply" className="transition-colors hover:text-foreground">Apply</Link>
        </div>
      </div>
    </footer>
  );
}
