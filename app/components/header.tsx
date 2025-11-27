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
      className={`border-b border-gray-300 dark:border-gray-700 bg-[#fef9f4] dark:bg-[#343541] px-4 py-3 ${className}`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {showLogo && (
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-green to-green-800 flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
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
