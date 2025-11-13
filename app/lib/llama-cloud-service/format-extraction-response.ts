import {
  extractSourceInfoFromRetrievalNodes,
  SourceInfo,
} from "../llama-cloud-service/extract-text-from-nodes";
import { AnswerWithQuery } from "./generate-answer";

export interface QueryAnswer {
  id: string;
  query: string;
  answer: string;
  sources: SourceInfo[];
  metadata?: {
    expectedFormat: string;
    requiredFields?: string[];
    context?: string;
  };
}

interface ExtractionResponse {
  success: boolean;
  message: string;
  results: QueryAnswer[];
  pipelineId: string;
}

export interface QueryMetadata {
  id: string;
  expectedType: string;
  requiredFields?: string[];
  context?: string;
}

export function formatExtractionResponse(
  answers: AnswerWithQuery[],
  queryRetrievalNodes: any[][],
  pipelineId: string,
  queryMetadata?: QueryMetadata[]
): ExtractionResponse {
  const results: QueryAnswer[] = answers.map((answerWithQuery, index) => {
    const retrievalNodes = queryRetrievalNodes[index] || [];
    const allSources = extractSourceInfoFromRetrievalNodes(retrievalNodes);
    const sources = allSources.filter(
      (source) =>
        source.score !== null &&
        source.score !== undefined &&
        source.score > 0.4
    );

    const metadata = queryMetadata?.[index];

    return {
      id: metadata?.id || `query_${index}`,
      query: answerWithQuery.query,
      answer: answerWithQuery.answer || "Aucune réponse trouvée.",
      sources,
      metadata: metadata
        ? {
            expectedFormat: metadata.expectedType,
          }
        : undefined,
    };
  });

  const response: ExtractionResponse = {
    success: true,
    message: "PDF extracted successfully",
    results,
    pipelineId,
  };

  console.log("📤 Sending response:", {
    success: response.success,
    resultsCount: results.length,
    totalSources: results.reduce((sum, r) => sum + r.sources.length, 0),
    resultsPreview: results.slice(0, 2).map((r) => ({
      query: r.query.substring(0, 50),
      answerLength: r.answer.length,
      sourcesCount: r.sources.length,
    })),
  });

  return response;
}
