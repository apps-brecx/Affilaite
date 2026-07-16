"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutLink({ label = "Sign out" }: { label?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <LogOut className="size-4" /> {label}
    </button>
  );
}
