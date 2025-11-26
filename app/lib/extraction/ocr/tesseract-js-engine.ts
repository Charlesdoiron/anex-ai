import Tesseract from "tesseract.js"
import { OCR_CONFIG } from "./config"

export interface OcrResult {
  text: string
  confidence?: number
  usedEngine: "tesseract-js"
}

let workerPool: Tesseract.Worker[] = []
let workerIndex = 0
let initPromise: Promise<void> | null = null

async function initWorkers(): Promise<void> {
  if (workerPool.length > 0) return

  const poolSize = Math.min(OCR_CONFIG.TESSERACT_JS_POOL_SIZE, 4)
  const langs = OCR_CONFIG.TESSERACT_LANG.replace("+", "+")

  const workers = await Promise.all(
    Array.from({ length: poolSize }, async () => {
      const worker = await Tesseract.createWorker(langs, 1, {
        cacheMethod: "none",
      })
      return worker
    })
  )

  workerPool = workers
}

function getNextWorker(): Tesseract.Worker {
  const worker = workerPool[workerIndex]
  workerIndex = (workerIndex + 1) % workerPool.length
  return worker
}

export class TesseractJsEngine {
  private static isAvailable: boolean | null = null

  static async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) return this.isAvailable

    try {
      if (!initPromise) {
        initPromise = initWorkers()
      }
      await initPromise
      this.isAvailable = workerPool.length > 0
    } catch (error) {
      console.warn("Tesseract.js initialization failed:", error)
      this.isAvailable = false
    }

    return this.isAvailable
  }

  static async recognize(imageBuffer: Buffer): Promise<OcrResult> {
    const available = await this.checkAvailability()
    if (!available) {
      throw new Error("Tesseract.js is not available.")
    }

    try {
      const worker = getNextWorker()
      const result = await worker.recognize(imageBuffer)

      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        usedEngine: "tesseract-js",
      }
    } catch (error) {
      throw new Error(
        `Tesseract.js OCR failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  static async terminate(): Promise<void> {
    await Promise.all(workerPool.map((w) => w.terminate()))
    workerPool = []
    initPromise = null
    this.isAvailable = null
  }
}
