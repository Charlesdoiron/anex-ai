import type { Metadata } from "next"
import "./globals.css"
import { EnvChecker } from "./components/env-checker"
import { validateEnv } from "./lib/env-check"

export const metadata: Metadata = {
  title: "AI Chat - Next.js + AI SDK",
  description:
    "AI-powered chat application built with Next.js and Vercel AI SDK",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Validate environment variables on server side (will fail build/dev if missing)
  if (process.env.NODE_ENV === "development") {
    validateEnv()
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <EnvChecker />
        {children}
      </body>
    </html>
  )
}
