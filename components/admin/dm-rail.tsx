"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import type { DmThreadSummary } from "@/lib/messaging";

/**
 * Direct-message rail. By default it shows only people the admin has actually
 * exchanged messages with; the search box finds ANY approved affiliate (even
 * ones never contacted) so a new conversation can be started.
 */
export function DmRail({ threads, selectedId }: { threads: DmThreadSummary[]; selectedId?: string }) {
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return threads.filter((t) => t.lastMessage); // only real conversations
    return threads.filter(
      (t) => t.name.toLowerCase().includes(query) || t.email.toLowerCase().includes(query),
    );
  }, [threads, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-hairline p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search people to message…"
            className="h-9 pl-8"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q.trim()
              ? "No one matches that search."
              : "No conversations yet. Search for a partner above to start one."}
          </p>
        ) : (
          list.map((t) => (
            <Link
              key={t.affiliateId}
              href={`/admin/messages?dm=${t.affiliateId}`}
              className={`flex items-center gap-3 border-b border-hairline/60 px-4 py-3 hover:bg-accent ${selectedId === t.affiliateId ? "bg-accent" : ""}`}
            >
              <Avatar name={t.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.lastMessage ? `${t.lastMessage.fromAdmin ? "You: " : ""}${t.lastMessage.preview}` : "Start a conversation"}
                </p>
              </div>
              {t.unread > 0 && (
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {t.unread}
                </span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
