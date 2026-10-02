export interface Citation {
  source: string;
  chunkId: string;
  preview: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  error?: boolean;
}

export interface Conversation {
  id: string; // doubles as the backend threadId
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface ChatResponse {
  threadId: string;
  answer: string;
  citations: Citation[];
}

export interface IngestSummary {
  ok: boolean;
  totalChunks: number;
  sources: string[];
}
