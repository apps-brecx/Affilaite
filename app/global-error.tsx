"use client";

// Root-level fallback: catches errors thrown in the root layout itself, where
// the normal error.tsx boundary can't render. Must include <html>/<body>.
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#fdf2f8", color: "#431431" }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#8b5a72", marginBottom: "1.5rem" }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ background: "#ff5c9e", color: "#fff", border: "none", borderRadius: 999, padding: "0.65rem 1.4rem", fontSize: "0.9rem", fontWeight: 500, cursor: "pointer" }}
          >
            Try again
          </button>
          {error.digest && <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#b98aa5" }}>Reference: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
