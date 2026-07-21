"use client";

import { useEffect, useRef } from "react";

/**
 * Drop this as the LAST child of a scrollable message list. On mount it scrolls
 * the list to the bottom so a chat opens on the newest message, like a real
 * messenger, instead of at the top.
 */
export function ScrollAnchor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Jump (not smooth) so it's already at the bottom when the view appears.
    ref.current?.scrollIntoView({ block: "end" });
  }, []);
  return <div ref={ref} aria-hidden="true" />;
}
