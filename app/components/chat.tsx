"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Sidebar } from "./chat/sidebar";
import { TopBar } from "./chat/top-bar";
import { MessagesArea } from "./chat/messages-area";
import { InputArea } from "./chat/input-area";
import { MessageWithSources } from "./chat/types";
import { usePdfHandler } from "./chat/hooks/use-pdf-handler";
import { useDataExtraction } from "./chat/hooks/use-data-extraction";

export function Chat() {
  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    setMessages,
    stop,
    append,
    setInput,
  } = useChat({
    api: "/api/chat",
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    uploadedPdf,
    isProcessingPdf,
    fileInputRef,
    handleFileSelect,
    removePdf,
  } = usePdfHandler({
    setMessages: setMessages as (
      messages:
        | MessageWithSources[]
        | ((messages: MessageWithSources[]) => MessageWithSources[])
    ) => void,
  });

  const { isExtractingData, handleExtractData } = useDataExtraction({
    messages: messages as MessageWithSources[],
    setMessages: setMessages as (
      messages:
        | MessageWithSources[]
        | ((messages: MessageWithSources[]) => MessageWithSources[])
    ) => void,
  });

  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!input.trim()) {
      return;
    }

    await append({
      role: "user",
      content: input,
    });
    setInput("");
  }

  function handleClearChat() {
    setMessages([]);
  }

  return (
    <div className="flex h-screen bg-white dark:bg-[#343541]">
      <Sidebar isOpen={sidebarOpen} onNewChat={handleClearChat} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onClearChat={handleClearChat}
          onExtractData={handleExtractData}
          hasMessages={messages.length > 0}
          isExtractingData={isExtractingData}
          isLoading={isLoading}
          isProcessingPdf={isProcessingPdf}
        />

        <MessagesArea
          messages={messages as MessageWithSources[]}
          isLoading={isLoading}
        />

        <InputArea
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleFormSubmit}
          onStop={stop}
          onFileSelect={handleFileSelect}
          uploadedPdf={uploadedPdf}
          onRemovePdf={removePdf}
          isLoading={isLoading}
          isProcessingPdf={isProcessingPdf}
          fileInputRef={fileInputRef}
        />
      </div>
    </div>
  );
}
