import path from "path"

export const RAG_CONFIG = {
  storageDir:
    process.env.RAG_STORAGE_DIR || path.join(process.cwd(), "storage", "rag"),
  embeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
  responsesModel: process.env.OPENAI_RESPONSES_MODEL || "gpt-5-mini",
}
