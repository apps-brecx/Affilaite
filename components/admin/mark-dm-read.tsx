"use client";

import { useEffect } from "react";
import { markDmReadByAdmin } from "@/app/actions/messaging";

export function MarkDmRead({ affiliateId }: { affiliateId: string }) {
  useEffect(() => {
    markDmReadByAdmin(affiliateId);
  }, [affiliateId]);
  return null;
}
