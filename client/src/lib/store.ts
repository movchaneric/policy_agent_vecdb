import { sendChat } from "./api";
import type { Conversation, Message } from "./types";

// Backend keeps the model's memory in its checkpointer but exposes no history
// endpoint, so the transcript shown in the UI is persisted locally per thread.
const STORAGE_KEY = "policy-agent:conversations";

export interface State {
  conversations: Conversation[];
  activeId: string | null;
  pendingIds: string[];
}

const EMPTY: State = { conversations: [], activeId: null, pendingIds: [] };

let state: State = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.conversations));
  } catch {
    // storage full or blocked: the chat still works for this session
  }
}

function set(next: Partial<State>, save = true) {
  state = { ...state, ...next };
  if (save) persist();
  listeners.forEach((l) => l());
}

function hydrate() {
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = { ...state, conversations: JSON.parse(raw) as Conversation[] };
  } catch {
    // corrupted storage: start empty
  }
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): State {
  if (!hydrated && typeof window !== "undefined") hydrate();
  return state;
}

export function getServerSnapshot(): State {
  return EMPTY;
}

const newId = () => crypto.randomUUID();

export function newChat() {
  set({ activeId: null }, false);
}

export function selectChat(id: string) {
  set({ activeId: id }, false);
}

export function deleteChat(id: string) {
  set({
    conversations: state.conversations.filter((c) => c.id !== id),
    activeId: state.activeId === id ? null : state.activeId,
  });
}

function update(id: string, fn: (c: Conversation) => Conversation) {
  set({
    conversations: state.conversations.map((c) => (c.id === id ? fn(c) : c)),
  });
}

function addMessage(id: string, message: Message) {
  update(id, (c) => ({
    ...c,
    messages: [...c.messages, message],
    updatedAt: Date.now(),
  }));
}

export async function sendMessage(text: string) {
  let id = state.activeId;
  const userMessage: Message = { id: newId(), role: "user", content: text };

  if (!id) {
    id = newId();
    const title = text.length > 48 ? `${text.slice(0, 48).trimEnd()}…` : text;
    set({
      conversations: [
        { id, title, messages: [userMessage], updatedAt: Date.now() },
        ...state.conversations,
      ],
      activeId: id,
    });
  } else {
    addMessage(id, userMessage);
  }

  set({ pendingIds: [...state.pendingIds, id] }, false);

  try {
    const res = await sendChat(id, text);
    addMessage(id, {
      id: newId(),
      role: "assistant",
      content: res.answer,
      citations: res.citations,
    });
  } catch (err) {
    addMessage(id, {
      id: newId(),
      role: "assistant",
      content: err instanceof Error ? err.message : "Something went wrong.",
      error: true,
    });
  } finally {
    const done = id;
    set({ pendingIds: state.pendingIds.filter((p) => p !== done) }, false);
  }
}
