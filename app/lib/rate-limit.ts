/**
 * Simple in-memory rate limiter for API endpoints.
 * Generous limits for in-house pro usage, but protects against accidental spam.
 */

interface RateLimitEntry {
  count: number
  windowStart: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

type RateLimitWindow = "minute" | "hour"

const DEFAULT_LIMITS: Record<RateLimitWindow, RateLimitConfig> = {
  minute: { windowMs: 60_000, maxRequests: 30 },
  hour: { windowMs: 3_600_000, maxRequests: 200 },
}

class RateLimiter {
  private store = new Map<string, Map<RateLimitWindow, RateLimitEntry>>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanup()
  }

  private startCleanup(): void {
    if (this.cleanupInterval) return
    this.cleanupInterval = setInterval(
      () => {
        const now = Date.now()
        for (const [key, windows] of this.store.entries()) {
          let allExpired = true
          for (const [window, entry] of windows.entries()) {
            const config = DEFAULT_LIMITS[window]
            if (now - entry.windowStart < config.windowMs * 2) {
              allExpired = false
            }
          }
          if (allExpired) {
            this.store.delete(key)
          }
        }
      },
      5 * 60_000 // cleanup every 5 minutes
    )
  }

  check(
    identifier: string,
    limits: Partial<Record<RateLimitWindow, RateLimitConfig>> = {}
  ): RateLimitResult {
    const now = Date.now()
    const userWindows = this.store.get(identifier) ?? new Map()
    const mergedLimits = { ...DEFAULT_LIMITS, ...limits }

    for (const [window, config] of Object.entries(mergedLimits)) {
      const windowKey = window as RateLimitWindow
      const entry = userWindows.get(windowKey)

      if (!entry || now - entry.windowStart > config.windowMs) {
        userWindows.set(windowKey, { count: 1, windowStart: now })
      } else {
        if (entry.count >= config.maxRequests) {
          const resetIn = Math.ceil(
            (entry.windowStart + config.windowMs - now) / 1000
          )
          return {
            allowed: false,
            reason: `Rate limit exceeded (${config.maxRequests}/${window})`,
            resetInSeconds: resetIn,
            window: windowKey,
          }
        }
        entry.count++
      }
    }

    this.store.set(identifier, userWindows)

    return { allowed: true }
  }

  reset(identifier: string): void {
    this.store.delete(identifier)
  }
}

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  resetInSeconds?: number
  window?: RateLimitWindow
}

export const rateLimiter = new RateLimiter()

export const EXTRACTION_JOB_LIMITS: Partial<
  Record<RateLimitWindow, RateLimitConfig>
> = {
  minute: { windowMs: 60_000, maxRequests: 20 },
  hour: { windowMs: 3_600_000, maxRequests: 150 },
}

