const ACTIVE_JOB_KEY = "anex_active_extraction_job"

export interface PersistedJob {
  jobId: string
  fileName: string
  startedAt: string
}

export function saveActiveJob(job: PersistedJob): void {
  if (typeof window === "undefined") return
  localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job))
}

export function getActiveJob(): PersistedJob | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(ACTIVE_JOB_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as PersistedJob
  } catch {
    return null
  }
}

export function clearActiveJob(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(ACTIVE_JOB_KEY)
}
