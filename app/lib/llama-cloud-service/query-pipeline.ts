import { runSearchApiV1PipelinesPipelineIdRetrievePost } from "llama-cloud-services/api";

interface QueryPipelineOptions {
  dense_similarity_top_k?: number;
  sparse_similarity_top_k?: number;
  enable_reranking?: boolean;
  rerank_top_n?: number;
  alpha?: number;
}

export async function queryPipeline(
  pipelineId: string,
  query: string,
  options?: QueryPipelineOptions
) {
  if (!pipelineId) {
    throw new Error("Pipeline ID is required");
  }

  console.log("🔍 Querying pipeline", pipelineId);
  console.log("🔍 Query", query);
  console.log("🔍 Options", options);

  const {
    dense_similarity_top_k = 20,
    sparse_similarity_top_k = 20,
    enable_reranking = true,
    rerank_top_n = 10,
    alpha = 0.5, // Hybrid retrieval: 0.5 balances dense and sparse
  } = options || {};

  const maxAttempts = 5;
  const baseDelayMs = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const results = await runSearchApiV1PipelinesPipelineIdRetrievePost({
        headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}` },
        path: { pipeline_id: pipelineId },
        body: {
          query,
          dense_similarity_top_k,
          sparse_similarity_top_k,
          enable_reranking,
          rerank_top_n,
          alpha,
        },
      });

      if (results.error) {
        console.error(
          `❌ Query pipeline error (attempt ${attempt}/${maxAttempts}):`,
          results.error
        );
        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to query pipeline: ${JSON.stringify(results.error)}`
          );
        }
      } else {
        console.log("✅ Results", results.data);
        return results.data;
      }
    } catch (error) {
      console.error(
        `❌ Error querying pipeline (attempt ${attempt}/${maxAttempts}):`,
        error
      );
      if (attempt === maxAttempts) {
        throw error;
      }
    }

    const backoffMs = Math.min(
      baseDelayMs * 2 ** (attempt - 1),
      10000
    );
    const jitterMs = Math.floor(Math.random() * 300);
    const delayMs = backoffMs + jitterMs;
    console.log(`⏳ Retrying pipeline query in ${delayMs}ms...`);
    await wait(delayMs);
  }

  throw new Error("Failed to query pipeline after multiple attempts");
}

async function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
