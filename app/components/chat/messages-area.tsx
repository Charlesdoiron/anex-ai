"use client";

import { useEffect, useRef } from "react";
import { MessageWithSources } from "./types";
import { MessageItem } from "./message-item";
import { LoadingIndicator } from "./loading-indicator";

interface MessagesAreaProps {
  messages: MessageWithSources[];
  isLoading: boolean;
}

export function MessagesArea({ messages, isLoading }: MessagesAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#fef9f4] dark:bg-[#343541]">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full px-4">
          <h1 className="text-8xl font-semibold text-[#033a17] dark:text-gray-100 mb-12 text-center">
            Anex AI
          </h1>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {isLoading && <LoadingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}

