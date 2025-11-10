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

  try {
    const results = await runSearchApiV1PipelinesPipelineIdRetrievePost({
      headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}` },
      path: { pipeline_id: pipelineId },
      body: {
        query: query,
        dense_similarity_top_k,
        sparse_similarity_top_k,
        enable_reranking,
        rerank_top_n,
        alpha,
      },
    });

    if (results.error) {
      console.error("❌ Query pipeline error:", results.error);
      throw new Error(
        `Failed to query pipeline: ${JSON.stringify(results.error)}`
      );
    }

    console.log("✅ Results", results.data);
    return results.data;
  } catch (error) {
    console.error("❌ Error querying pipeline", error);
    throw error;
  }
}
