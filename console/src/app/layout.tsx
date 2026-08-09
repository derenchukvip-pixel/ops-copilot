import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { DemoBanner } from "@/components/DemoBanner";
import { OperatorProvider } from "@/components/OperatorProvider";

// One typeface, one weight range. Two families on a screen like this would be one too many.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Ops Copilot console",
  description:
    "Operator console for Ops Copilot: review the actions the agent wants to take, approve or reject them, and read the audit trail behind every decision.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-dvh`}>
        <OperatorProvider>
          <AppHeader />
          <DemoBanner />
          {/*
            Capped at 880px and centred. Approval cards are dense with text the operator has to
            actually read, and a line that runs the width of a 27-inch monitor is a line people
            skim instead of read.
          */}
          <main className="mx-auto max-w-[880px] px-4 py-8 sm:py-12">{children}</main>
        </OperatorProvider>
      </body>
    </html>
  );
}
