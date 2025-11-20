import fs from "fs/promises"
import path from "path"

const STORAGE_BASE_DIR = path.join(process.cwd(), "storage")
const EXTRACTIONS_DIR = path.join(STORAGE_BASE_DIR, "extractions")
const EXTRACTIONS_RAW_TEXT_DIR = path.join(EXTRACTIONS_DIR, "raw-text")
const RAG_DIR = path.join(STORAGE_BASE_DIR, "rag")
const RAG_DOCUMENTS_DIR = path.join(RAG_DIR, "documents")
const RAG_CHUNKS_DIR = path.join(RAG_DIR, "chunks")

const STORAGE_DIRS = [
  STORAGE_BASE_DIR,
  EXTRACTIONS_DIR,
  EXTRACTIONS_RAW_TEXT_DIR,
  RAG_DIR,
  RAG_DOCUMENTS_DIR,
  RAG_CHUNKS_DIR,
]

let initializationPromise: Promise<void> | null = null

export async function ensureStorageStructure(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async () => {
    await Promise.all(
      STORAGE_DIRS.map((dir) => fs.mkdir(dir, { recursive: true }))
    )
  })()

  return initializationPromise
}
