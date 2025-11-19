import { execFile } from "child_process"
import { promisify } from "util"
import { OCR_CONFIG } from "./config"

const execFileAsync = promisify(execFile)

export interface OcrResult {
  text: string
  confidence?: number
  usedEngine: "tesseract"
}

export class TesseractEngine {
  private static isAvailable: boolean | null = null

  static async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) return this.isAvailable
    try {
      await execFileAsync(OCR_CONFIG.TESSERACT_BINARY_PATH, ["--version"])
      this.isAvailable = true
    } catch (error) {
      console.warn("Tesseract binary not found or not working:", error)
      this.isAvailable = false
    }
    return this.isAvailable
  }

  static async recognize(imageBuffer: Buffer): Promise<OcrResult> {
    const available = await this.checkAvailability()
    if (!available) {
      throw new Error("Tesseract OCR is not available on this system.")
    }

    try {
      const child = execFile(
        OCR_CONFIG.TESSERACT_BINARY_PATH,
        ["stdin", "stdout", "-l", OCR_CONFIG.TESSERACT_LANG, "--psm", "1"],
        {
          timeout: OCR_CONFIG.TESSERACT_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        }
      )

      let stdout = ""
      let stderr = ""

      if (child.stdout) {
        child.stdout.on("data", (data) => {
          stdout += data
        })
      }

      if (child.stderr) {
        child.stderr.on("data", (data) => {
          stderr += data
        })
      }

      if (child.stdin) {
        child.stdin.write(imageBuffer)
        child.stdin.end()
      }

      await new Promise<void>((resolve, reject) => {
        child.on("close", (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Tesseract exited with code ${code}: ${stderr}`))
          }
        })
        child.on("error", (err) => {
          reject(err)
        })
      })

      return {
        text: stdout.trim(),
        usedEngine: "tesseract",
      }
    } catch (error) {
      throw new Error(
        `OCR failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
