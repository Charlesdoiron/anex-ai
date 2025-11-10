"use client";

import { useState } from "react";
import { MessageWithSources } from "../types";

interface UseDataExtractionProps {
  messages: MessageWithSources[];
  setMessages: (
    messages:
      | MessageWithSources[]
      | ((messages: MessageWithSources[]) => MessageWithSources[])
  ) => void;
}

export function useDataExtraction({
  messages,
  setMessages,
}: UseDataExtractionProps) {
  const [isExtractingData, setIsExtractingData] = useState(false);

  async function handleExtractData() {
    console.log("Extract data button clicked");
    setIsExtractingData(true);
    try {
      const userMessage: MessageWithSources = {
        id: Date.now().toString(),
        role: "user",
        content: "Extraction des données structurées du document...",
      };
      setMessages((prev) => [...prev, userMessage]);

      const currentMessages = messages;
      console.log(
        "Sending extraction request with messages:",
        currentMessages.length
      );

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: currentMessages,
          extractData: true,
        }),
      });

      console.log("Response status:", response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", errorText);
        throw new Error(
          `Failed to extract data: ${response.status} ${errorText}`
        );
      }

      if (!response.body) {
        throw new Error("No response body available");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessageId = `extract-${Date.now()}`;
      let assistantContent = "";
      let buffer = "";

      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ]);

      try {
        let chunkIndex = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("[Client] Stream finished, buffer:", buffer);
            break;
          }

          chunkIndex++;
          const rawChunk = decoder.decode(value, { stream: true });
          console.log(
            `[Client] Raw chunk ${chunkIndex}:`,
            rawChunk.substring(0, 200)
          );

          buffer += rawChunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            console.log("[Client] Processing line:", line.substring(0, 200));

            const match = line.match(/^0:(.+)$/);
            if (match) {
              try {
                const jsonStr = match[1];
                console.log("[Client] JSON string:", jsonStr.substring(0, 200));
                const data = JSON.parse(jsonStr);
                console.log("[Client] Parsed data:", data);

                if (data.type === "text" && typeof data.text === "string") {
                  console.log(
                    "[Client] Adding text:",
                    data.text.substring(0, 100)
                  );
                  assistantContent += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: assistantContent }
                        : msg
                    )
                  );
                } else {
                  console.warn("[Client] Unexpected data format:", data);
                }
              } catch (e) {
                console.error(
                  "[Client] Failed to parse stream chunk:",
                  line,
                  e
                );
              }
            } else {
              try {
                const data = JSON.parse(line);
                console.log("[Client] Parsed as raw JSON:", data);
                if (data.type === "text" && typeof data.text === "string") {
                  assistantContent += data.text;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: assistantContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                console.debug("[Client] Non-JSON line:", line);
              }
            }
          }
        }

        console.log(
          "[Client] Final assistant content length:",
          assistantContent.length
        );

        if (buffer.trim()) {
          const match = buffer.match(/^0:(.+)$/);
          if (match) {
            try {
              const data = JSON.parse(match[1]);
              if (data.type === "text" && typeof data.text === "string") {
                assistantContent += data.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: assistantContent }
                      : msg
                  )
                );
              }
            } catch (e) {
              console.error("Failed to parse final buffer:", e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!assistantContent.trim()) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content:
                    "Aucune donnée extraite. Veuillez vérifier que le document a été chargé.",
                }
              : msg
          )
        );
      }
    } catch (error) {
      console.error("Data extraction error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `extract-error-${Date.now()}`,
          role: "assistant",
          content: `❌ Erreur lors de l'extraction des données: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ]);
    } finally {
      setIsExtractingData(false);
    }
  }

  return {
    isExtractingData,
    handleExtractData,
  };
}

