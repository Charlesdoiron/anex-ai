import { NextRequest, NextResponse } from "next/server";
import { createPipeline } from "@/app/lib/llama-cloud-service/create-pipeline";
import { addFileToPipeline } from "@/app/lib/llama-cloud-service/add-file-to-pipeline";
import { queryPipeline } from "@/app/lib/llama-cloud-service/query-pipeline";
import { waitForPipelineFilesIndexing } from "@/app/lib/llama-cloud-service/wait-for-indexing";
import {
  deduplicateRetrievalNodes,
  truncateContextByRelevance,
} from "@/app/lib/llama-cloud-service/extract-text-from-nodes";
import { generateAnswerFromContext } from "@/app/lib/llama-cloud-service/generate-answer";
import { formatExtractionResponse } from "@/app/lib/llama-cloud-service/format-extraction-response";
import { bailQueries } from "@/app/lib/queries/bail-queries";

export const maxDuration = 600; // 10 minutes for large PDFs

// ============================================
// DEV MODE: Set these to bypass PDF upload
// ============================================
const USE_DEV_MODE = process.env.USE_DEV_MODE === "true";
const DEV_PIPELINE_ID = process.env.DEV_PIPELINE_ID; // Your existing pipeline ID
const DEV_FILE_ID = process.env.DEV_FILE_ID; // Your already parsed file ID
const DEV_PAGE_COUNT = parseInt(process.env.DEV_PAGE_COUNT || "20"); // Estimated page count
// ============================================

export async function POST(req: NextRequest) {
  try {
    let pipelineId: string | undefined;
    let fileId: string;
    let pageCount: number;

    // ============================================
    // DEV MODE: Use hardcoded pipeline and file
    // ============================================
    if (USE_DEV_MODE && DEV_PIPELINE_ID && DEV_FILE_ID) {
      console.log("🚀 DEV MODE: Using existing pipeline and file");
      pipelineId = DEV_PIPELINE_ID;
      fileId = DEV_FILE_ID;
      pageCount = DEV_PAGE_COUNT;
      console.log(`📋 Pipeline ID: ${pipelineId}`);
      console.log(`📄 File ID: ${fileId}`);
      console.log(`📊 Page count: ${pageCount}`);
    }
    // ============================================
    // PRODUCTION MODE: Upload and index file
    // ============================================
    else {
      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided" },
          { status: 400 }
        );
      }

      try {
        pipelineId = await createPipeline();
      } catch (error) {
        console.error("Pipeline creation error:", error);
        return NextResponse.json(
          {
            error: "Failed to create or reuse pipeline",
            message:
              error instanceof Error
                ? error.message
                : "Unknown error. You may have reached the pipeline limit.",
          },
          { status: 500 }
        );
      }

      if (!pipelineId) {
        return NextResponse.json(
          { error: "Failed to create pipeline: no ID returned" },
          { status: 500 }
        );
      }

      const pipelineFiles = await addFileToPipeline(file, pipelineId);
      fileId = pipelineFiles.file_id;
      console.log("✅ File added to pipeline", pipelineFiles.file_id);

      // Wait for file indexing to complete
      console.log("⏳ Waiting for file indexing...");
      const indexingStart = Date.now();
      const indexResult = await waitForPipelineFilesIndexing(
        pipelineId,
        300000
      ); // 5 minutes for larger PDFs
      pageCount = indexResult.pageCount;
      console.log(
        `✅ Indexing completed in ${(Date.now() - indexingStart) / 1000}s`
      );
    }

    // Extract query strings from structured queries
    const queries = bailQueries.map((q) => q.query);

    // Scale retrieval parameters based on document size
    // Small docs (1-20 pages): baseline parameters
    // Medium docs (21-50 pages): increased parameters
    // Large docs (51+ pages): maximum parameters
    const scaleFactor = pageCount <= 20 ? 1 : pageCount <= 50 ? 2 : 3;
    const retrievalOptions = {
      dense_similarity_top_k: 20 * scaleFactor,
      sparse_similarity_top_k: 20 * scaleFactor,
      enable_reranking: true, // Disabled - HuggingFace endpoint issues
      rerank_top_n: 10 * scaleFactor,
      alpha: 0.5, // Hybrid retrieval
      file_ids: [fileId], // Only query the file we just uploaded
    };
    console.log(
      `📊 Document size: ${pageCount} pages, using scale factor: ${scaleFactor}x`
    );
    const results = await Promise.all(
      queries.map((query) => queryPipeline(pipelineId, query, retrievalOptions))
    );

    // Process each query with its own context
    interface QueryContextData {
      query: string;
      context: string;
      retrievalNodes: any[];
    }

    const queryContexts: QueryContextData[] = results.map(
      (result: any, index: number) => {
        const retrievalNodes = result?.retrieval_nodes || [];
        console.log(
          `📄 Query ${index + 1} retrieved ${retrievalNodes.length} nodes`
        );

        // Deduplicate nodes for this query
        const deduplicatedNodes = deduplicateRetrievalNodes(retrievalNodes);

        // Scale context length and adjust score threshold based on document size
        // Larger docs need more context and can tolerate lower scores
        const maxContextLength = 4000 * scaleFactor;
        const minScore = pageCount <= 20 ? 0.5 : pageCount <= 50 ? 0.4 : 0.3;
        const context = truncateContextByRelevance(
          deduplicatedNodes,
          maxContextLength,
          minScore
        );

        console.log(
          `📝 Query ${index + 1}: ${
            deduplicatedNodes.length
          } nodes after dedup, context length: ${
            context.length
          } chars, minScore: ${minScore}`
        );

        return {
          query: queries[index],
          context,
          retrievalNodes: deduplicatedNodes,
        };
      }
    );

    // Generate answers with query-specific contexts
    const answers = await generateAnswerFromContext({
      queryContexts: queryContexts.map((qc: QueryContextData) => ({
        query: qc.query,
        context: qc.context,
      })),
      maxTokens: queries.length > 10 ? 2000 : queries.length > 5 ? 1500 : 1000,
    });

    // Prepare query metadata for structured response
    const queryMetadata = bailQueries.map((q) => ({
      id: q.id,
      expectedType: q.expectedType,
    }));

    if (!answers) {
      // Fallback to extracted text if generation fails
      const fallbackAnswers = queryContexts.map(
        (qc: QueryContextData, index) => ({
          query: qc.query,
          answer: qc.context || "Aucune réponse trouvée.",
          index,
        })
      );
      const response = formatExtractionResponse(
        fallbackAnswers,
        queryContexts.map((qc) => qc.retrievalNodes),
        pipelineId,
        queryMetadata
      );
      return NextResponse.json(response, { status: 200 });
    }

    // Map answers to their corresponding retrieval nodes
    const queryRetrievalNodes = queryContexts.map((qc) => qc.retrievalNodes);

    const response = formatExtractionResponse(
      answers,
      queryRetrievalNodes,
      pipelineId,
      queryMetadata
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return NextResponse.json(
      {
        error: "Failed to extract PDF",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
