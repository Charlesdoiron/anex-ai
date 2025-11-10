"use client";

import { useState, useRef } from "react";
import { MessageWithSources } from "../types";
import { SourceInfo } from "@/app/lib/llama-cloud-service/extract-text-from-nodes";

interface UsePdfHandlerProps {
  setMessages: (
    messages:
      | MessageWithSources[]
      | ((messages: MessageWithSources[]) => MessageWithSources[])
  ) => void;
}

export function usePdfHandler({ setMessages }: UsePdfHandlerProps) {
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePdfUpload(file: File) {
    setIsProcessingPdf(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const endpoint = "/api/extract-pdf";
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process PDF");
      }

      const result = await response.json();
      console.log("📄 PDF upload result:", result);

      const userMessage: MessageWithSources = {
        id: Date.now().toString(),
        role: "user",
        content: `Uploaded PDF: ${file.name}`,
      };

      const assistantMessages: MessageWithSources[] = [];

      if (
        result.results &&
        Array.isArray(result.results) &&
        result.results.length > 0
      ) {
        console.log("✅ Displaying results, count:", result.results.length);

        result.results.forEach((queryResult: any, index: number) => {
          const content = `**Q: ${queryResult.query}**\n${
            queryResult.answer || "Aucune réponse trouvée."
          }`;

          let answerSources: SourceInfo[] = [];
          if (
            queryResult.sources &&
            Array.isArray(queryResult.sources) &&
            queryResult.sources.length > 0
          ) {
            const uniqueSources = queryResult.sources.filter(
              (source: any, idx: number, self: any[]) =>
                idx ===
                self.findIndex(
                  (s: any) =>
                    s.pageNumber === source.pageNumber &&
                    s.fileName === source.fileName
                )
            );

            answerSources = uniqueSources.map((source: any) => ({
              pageNumber: source.pageNumber,
              fileName: source.fileName,
              score: source.score,
              startCharIdx: source.startCharIdx,
              endCharIdx: source.endCharIdx,
              metadata: source.metadata,
            }));
          }

          assistantMessages.push({
            id: `pdf-result-${Date.now()}-${index}`,
            role: "assistant",
            content,
            sources: answerSources.length > 0 ? answerSources : undefined,
          });
        });
      } else if (result.message) {
        console.log("📝 Displaying message:", result.message);
        assistantMessages.push({
          id: `pdf-results-${Date.now()}`,
          role: "assistant",
          content: result.message,
        });
      } else {
        console.warn("⚠️ No results or message in response:", result);
        assistantMessages.push({
          id: `pdf-results-${Date.now()}`,
          role: "assistant",
          content: "PDF traité mais aucun résultat de requête disponible.",
        });
      }

      setMessages((prev) => [...prev, userMessage, ...assistantMessages]);
      setUploadedPdf(null);
    } catch (error) {
      console.error("PDF upload error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `pdf-error-${Date.now()}`,
          role: "assistant",
          content: `❌ Erreur lors du traitement du PDF: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ]);
      setUploadedPdf(null);
    } finally {
      setIsProcessingPdf(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedPdf(file);
      console.log("PDF selected:", file.name);
      await handlePdfUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } else if (file) {
      alert("Please select a PDF file");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function removePdf() {
    setUploadedPdf(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return {
    uploadedPdf,
    isProcessingPdf,
    fileInputRef,
    handleFileSelect,
    removePdf,
  };
}

