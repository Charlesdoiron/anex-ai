"use client"

import { useEffect, useState, useRef } from "react"
import { usePathname } from "next/navigation"

export function NavigationProgress() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const timersRef = useRef<NodeJS.Timeout[]>([])
  const currentPathRef = useRef<string>("")

  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest("a[href]")

      if (link) {
        const href = link.getAttribute("href")
        if (href && href.startsWith("/") && href !== currentPathRef.current) {
          setIsLoading(true)
          setProgress(5)

          timersRef.current.forEach(clearTimeout)

          const timer1 = setTimeout(() => setProgress(25), 50)
          const timer2 = setTimeout(() => setProgress(60), 150)
          const timer3 = setTimeout(() => setProgress(85), 300)

          timersRef.current = [timer1, timer2, timer3]
        }
      }
    }

    document.addEventListener("mousedown", handleLinkClick, true)

    return () => {
      document.removeEventListener("mousedown", handleLinkClick, true)
      timersRef.current.forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    if (pathname && pathname !== currentPathRef.current) {
      currentPathRef.current = pathname

      if (isLoading) {
        setProgress(100)
        const timer = setTimeout(() => {
          setIsLoading(false)
          setProgress(0)
        }, 100)

        return () => clearTimeout(timer)
      }
    }
  }, [pathname, isLoading])

  if (!isLoading && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gray-200/50 dark:bg-gray-800/50">
      <div
        className="h-full bg-gradient-to-r from-brand-green to-green-600 dark:from-brand-green dark:to-green-600 transition-all duration-100 ease-out shadow-sm"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
