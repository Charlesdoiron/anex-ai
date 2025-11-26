import type { Metadata } from "next"
import "./globals.css"
import { EnvChecker } from "./components/env-checker"
import { validateEnv } from "./lib/env-check"

export const metadata: Metadata = {
  title: "Anex AI - Agents intelligents",
  description:
    "Automatisez vos tâches complexes avec nos agents IA spécialisés",
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
    <html lang="fr">
      <body className="antialiased bg-brand-cream">
        <EnvChecker />
        {children}
      </body>
    </html>
  )
}
