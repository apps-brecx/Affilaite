// lib/csv.ts — tiny CSV builder (RFC-4180-ish quoting). Safe for client use.

function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Build a CSV string from a header row + object rows keyed by header. */
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const head = headers.map(cell).join(",");
  const body = rows.map((r) => headers.map((h) => cell(r[h])).join(",")).join("\n");
  return body ? `${head}\n${body}` : head;
}

/** Trigger a client-side download of CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
