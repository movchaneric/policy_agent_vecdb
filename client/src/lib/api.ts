import type { ChatResponse, IngestSummary } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  try {
    return await parse<T>(await fetch(`${API_URL}${path}`, init));
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(`Can't reach the backend at ${API_URL}. Is it running?`);
    }
    throw err;
  }
}

export function sendChat(threadId: string, message: string) {
  return request<ChatResponse>("/api/v1/agents/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, message }),
  });
}

export function uploadDocument(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<IngestSummary>("/api/v1/kb/upload", {
    method: "POST",
    body: form,
  });
}
