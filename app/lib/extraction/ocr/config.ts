// Detect serverless environment (Vercel, AWS Lambda, etc.)
const IS_SERVERLESS =
  process.env.VERCEL === "1" ||
  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
  process.env.OCR_USE_JS === "true"

// OCR engine selection: "auto" | "tesseract" | "mistral"
// - "auto": Use Mistral if available, fallback to Tesseract
// - "tesseract": Force Tesseract (local binary or JS)
// - "mistral": Force Mistral (requires MISTRAL_API_KEY)
const OCR_ENGINE = (process.env.OCR_ENGINE || "auto") as
  | "auto"
  | "tesseract"
  | "mistral"

export const OCR_CONFIG = {
  // Environment detection
  IS_SERVERLESS,

  // OCR engine preference
  OCR_ENGINE,

  // Tesseract binary (local development)
  TESSERACT_BINARY_PATH: process.env.PDF_OCR_BINARY_PATH || "tesseract",
  TESSERACT_LANG: process.env.PDF_OCR_LANG || "fra+eng",
  TESSERACT_CONCURRENCY: Math.max(
    1,
    Number(process.env.PDF_OCR_CONCURRENCY || "4")
  ),
  TESSERACT_TIMEOUT_MS: Number(process.env.PDF_OCR_TIMEOUT_MS || "30000"),

  // Tesseract.js (serverless/Vercel)
  TESSERACT_JS_POOL_SIZE: Math.max(
    1,
    Number(process.env.PDF_OCR_JS_POOL_SIZE || "2")
  ),

  // OCR trigger thresholds
  MIN_TOTAL_CHARS: Number(process.env.PDF_VISION_MIN_TOTAL_CHARS || "200"),
  MIN_AVG_CHARS_PER_PAGE: Number(
    process.env.PDF_VISION_MIN_AVG_CHARS_PER_PAGE || "30"
  ),
  MIN_NON_WHITESPACE_RATIO: Number(
    process.env.PDF_VISION_MIN_NON_WHITESPACE_RATIO || "0.2"
  ),

  // Vision OCR fallback
  VISION_MODEL: process.env.OPENAI_VISION_MODEL || "gpt-5-nano",
  VISION_RENDER_SCALE: Number(process.env.PDF_VISION_RENDER_SCALE || "1.75"),
  VISION_MAX_RETRIES: Number(process.env.PDF_VISION_MAX_RETRIES || "2"),
  VISION_CONCURRENCY: Math.max(
    1,
    Number(process.env.PDF_VISION_CONCURRENCY || "5")
  ),

  // Mistral OCR
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
}
