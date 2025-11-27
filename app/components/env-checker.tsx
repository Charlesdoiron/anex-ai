"use client"

import { useEffect, useState } from "react"

export function EnvChecker() {
  const [status, setStatus] = useState<{
    valid: boolean
    missing: string[]
    errors: string[]
  } | null>(null)

  useEffect(() => {
    async function checkEnv() {
      try {
        const response = await fetch("/api/check-env")

        // Check if response is ok and is JSON
        if (!response.ok) {
          return // Silently fail if API is not accessible
        }

        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          return // Silently fail if response is not JSON (might be HTML redirect)
        }

        const data = await response.json()
        setStatus(data)
      } catch (error) {
        // Silently fail - don't show errors in console for expected failures
        // (e.g., when API is not accessible on login page)
      }
    }

    checkEnv()
  }, [])

  if (!status || status.valid) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-lg font-bold mb-2">
          ❌ Missing Required Environment Variables
        </h2>
        <ul className="list-disc list-inside space-y-1">
          {status.errors.map((error, index) => (
            <li key={index} className="text-sm">
              {error}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          Please set these variables in your .env.local file.
        </p>
      </div>
    </div>
  )
}
