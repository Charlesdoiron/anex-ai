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

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    let pipelineId: string | undefined;
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
    console.log("✅ File added to pipeline", pipelineFiles);

    // Wait for file indexing to complete
    console.log("⏳ Waiting for file indexing...");
    await waitForPipelineFilesIndexing(pipelineId, 120000); // 2 minutes max wait

    const queries = [
      "Quel est le nom du bailleur et ses coordonnées (courriel, téléphone, adresse,siret) ?",
      "Quel est le nom du représentant du bailleur  le cas échéant et ses coordonnées (capital, adresse,représentant légal) ?",
      "Quel est le nom du preneur et ses coordonnées (courriel, représentant légal, adresse,siret) ?",
      "Quelles sont les conditions ou informations liées à la pose d'une enseigne ?",
      "Quelle est la destination des locaux ?",
      "Quelle est la désignation des locaux ?",
      "Quelle est l'adresse des locaux ?",
      "Quelle est l'année de construction de l'immeuble ?",
      "Quels sont les étages des locaux ?",
      "Quels sont les numéros de lots ?",
      "Quelle est la surface des locaux (en m²) ?",
      "Les locaux sont-ils cloisonnés ? Répondre par « oui » ou « non » en précisant",
      "Les locaux sont-ils équipés avec du mobilier ? Répondre par « oui » ou « non » en précisant",
      "Quelles sont les conditions de garnissement des locaux ?",
    ];

    // Query with enhanced retrieval parameters
    const retrievalOptions = {
      dense_similarity_top_k: 20,
      sparse_similarity_top_k: 20,
      enable_reranking: true,
      rerank_top_n: 10,
      alpha: 0.5, // Hybrid retrieval
    };

    console.log("🔍 Querying with enhanced retrieval parameters");
    const results = await Promise.all(
      queries.map((query) => queryPipeline(pipelineId, query, retrievalOptions))
    );
    console.log("✅ Results", JSON.stringify(results, null, 2));

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

        // Use relevance-based truncation with stricter filtering
        const maxContextLength = 4000; // Reduced per-query context
        const minScore = 0.5; // Only include nodes with score >= 0.5
        const context = truncateContextByRelevance(
          deduplicatedNodes,
          maxContextLength,
          minScore
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
        pipelineId
      );
      return NextResponse.json(response, { status: 200 });
    }

    // Map answers to their corresponding retrieval nodes
    const queryRetrievalNodes = queryContexts.map((qc) => qc.retrievalNodes);

    const response = formatExtractionResponse(
      answers,
      queryRetrievalNodes,
      pipelineId
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
