import { runSearchApiV1PipelinesPipelineIdRetrievePost } from "llama-cloud-services/api";

interface QueryPipelineOptions {
  dense_similarity_top_k?: number;
  sparse_similarity_top_k?: number;
  enable_reranking?: boolean;
  rerank_top_n?: number;
  alpha?: number;
  file_ids?: string[]; // Filter by specific file IDs
}

export async function queryPipeline(
  pipelineId: string,
  query: string,
  options?: QueryPipelineOptions
) {
  if (!pipelineId) {
    throw new Error("Pipeline ID is required");
  }

  const {
    dense_similarity_top_k = 20,
    sparse_similarity_top_k = 20,
    enable_reranking = true, // Disabled by default due to HuggingFace endpoint issues
    rerank_top_n = 10,
    alpha = 0.5, // Hybrid retrieval: 0.5 balances dense and sparse
    file_ids,
  } = options || {};

  try {
    const body: any = {
      query: query,
      dense_similarity_top_k,
      sparse_similarity_top_k,
      enable_reranking,
      rerank_top_n,
      alpha,
    };

    // Add file_ids filter if provided
    if (file_ids && file_ids.length > 0) {
      body.search_filters = {
        filters: [
          {
            key: "file_id",
            value: file_ids,
            operator: "in",
          },
        ],
      };
      console.log("🔍 Filtering by file IDs:", file_ids);
    }

    const results = await runSearchApiV1PipelinesPipelineIdRetrievePost({
      headers: { Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}` },
      path: { pipeline_id: pipelineId },
      body,
    });

    if (results.error) {
      console.error("❌ Query pipeline error:", results.error);
      throw new Error(
        `Failed to query pipeline: ${JSON.stringify(results.error)}`
      );
    }
    return results.data;
  } catch (error) {
    console.error("❌ Error querying pipeline", error);
    throw error;
  }
}
