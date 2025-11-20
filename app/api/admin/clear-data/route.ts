import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { auth } from "@/app/lib/auth"
import { IS_TEST_MODE } from "@/app/lib/runtime"

const TARGET_DIRECTORIES = [
  path.join(process.cwd(), "storage", "extractions"),
  path.join(process.cwd(), "storage", "rag"),
]

interface ClearStats {
  path: string
  files: number
  sizeBytes: number
}

async function collectStats(targetPath: string): Promise<ClearStats> {
  async function walk(dir: string): Promise<{ files: number; size: number }> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      let totalFiles = 0
      let totalSize = 0

      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          const result = await walk(entryPath)
          totalFiles += result.files
          totalSize += result.size
        } else {
          totalFiles += 1
          const stats = await fs.stat(entryPath)
          totalSize += stats.size
        }
      }

      return { files: totalFiles, size: totalSize }
    } catch {
      return { files: 0, size: 0 }
    }
  }

  const { files, size } = await walk(targetPath)
  return { path: targetPath, files, sizeBytes: size }
}

async function resetDirectory(targetPath: string): Promise<ClearStats> {
  const stats = await collectStats(targetPath)
  await fs.rm(targetPath, { recursive: true, force: true })
  await fs.mkdir(targetPath, { recursive: true })
  return stats
}

export async function POST(request: NextRequest) {
  if (!IS_TEST_MODE) {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "Cette opération est réservée au mode test.",
      },
      { status: 403 }
    )
  }

  try {
    const skipAuth = process.env.SKIP_AUTH === "true"

    if (!skipAuth) {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Unauthorized", message: "Authentication required" },
          { status: 401 }
        )
      }
    }

    const results: ClearStats[] = []

    for (const dir of TARGET_DIRECTORIES) {
      results.push(await resetDirectory(dir))
    }

    const totalFiles = results.reduce((sum, stat) => sum + stat.files, 0)
    const totalSize = results.reduce((sum, stat) => sum + stat.sizeBytes, 0)

    return NextResponse.json({
      success: true,
      cleared: results,
      summary: {
        totalFiles,
        totalSizeBytes: totalSize,
      },
      message: "Toutes les données locales ont été effacées.",
    })
  } catch (error) {
    console.error("Failed to clear local data:", error)
    return NextResponse.json(
      {
        error: "clear_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
