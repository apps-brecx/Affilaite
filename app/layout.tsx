import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sipfluence — Affiliate & Referral Program",
    template: "%s · Sipfluence",
  },
  description:
    "Sipfluence is our affiliate & referral program — sip it, share it, sweeten the deal. Coupon-first attribution, native PayPal payouts, and a partner portal for our sweetest sippers.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sipfluence", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF7F1" },
    { media: "(prefers-color-scheme: dark)", color: "#14110C" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${instrument.variable} ${bricolage.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen font-sans">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
