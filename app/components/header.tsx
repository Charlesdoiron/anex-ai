"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserMenu } from "./user-menu"

interface HeaderProps {
  showLogo?: boolean
  className?: string
}

export function Header({ showLogo = true, className = "" }: HeaderProps) {
  const pathname = usePathname()

  // Hide header in chat pages (they have their own TopBar)
  if (pathname?.includes("/chat")) {
    return null
  }

  return (
    <header
      className={`border-b border-gray-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        {showLogo && (
          <Link
            href="/"
            prefetch={true}
            className="flex items-center gap-2.5 group transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 focus-visible:ring-offset-2 rounded-lg px-1"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-green to-green-800 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg tracking-tight">
              Axen AI
            </span>
          </Link>
        )}
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
