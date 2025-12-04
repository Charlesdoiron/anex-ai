import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb"
import Link from "next/link"
import { ReactNode } from "react"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeroProps {
  breadcrumbs: BreadcrumbItem[]
  title: string
  description?: string
  badge?: {
    icon?: ReactNode
    text: string
  }
}

export function PageHero({
  breadcrumbs,
  title,
  description,
  badge,
}: PageHeroProps) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-brand-cream via-white to-brand-cream/50">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 z-10">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.href ? (
                    <BreadcrumbLink asChild>
                      <Link
                        href={item.href}
                        className="transition-colors hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 focus-visible:ring-offset-2 rounded px-1"
                      >
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <div className="text-center max-w-3xl mx-auto animate-in fade-in slide-in-from-top-2">
          {badge && (
            <div className="inline-flex items-center gap-2 bg-brand-green/10 backdrop-blur-sm text-brand-green px-4 py-2 rounded-full text-xs font-medium mb-6 border border-brand-green/20">
              {badge.icon && <span>{badge.icon}</span>}
              {badge.text}
            </div>
          )}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-brand-green mb-4 sm:mb-6 tracking-tight px-2 text-balance">
            {title}
          </h1>
          {description && (
            <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto text-balance">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
