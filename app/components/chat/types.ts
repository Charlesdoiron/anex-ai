import { SourceInfo } from "@/app/lib/llama-cloud-service/extract-text-from-nodes";

export interface MessageWithSources {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceInfo[];
}

