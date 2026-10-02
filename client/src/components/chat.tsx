"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BookOpen, Menu, Sparkles } from "lucide-react";
import { sendMessage } from "@/lib/store";
import type { Conversation } from "@/lib/types";
import { MessageView, ThinkingIndicator } from "./message";

const SUGGESTIONS = [
  "What does the knowledge base cover?",
  "Summarize the key policies in the documents I uploaded",
  "What is my name? (I haven't told you yet)",
];

export function Chat({
  conversation,
  pending,
  onOpenSidebar,
  onOpenKb,
}: {
  conversation: Conversation | undefined;
  pending: boolean;
  onOpenSidebar: () => void;
  onOpenKb: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messages = conversation?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, pending, conversation?.id]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [conversation?.id]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    void sendMessage(trimmed);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
        <button
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="rounded-md p-1.5 hover:bg-accent"
        >
          <Menu className="size-5" />
        </button>
        <span className="truncate text-sm font-medium">
          {conversation?.title ?? "New chat"}
        </span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
            <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Sparkles className="size-6" />
            </div>
            <h1 className="font-serif text-3xl tracking-tight">
              How can I help today?
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask about your policy documents, or just chat. Answers from the
              knowledge base come with sources.
            </p>
            <div className="mt-8 flex w-full flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
              <button
                onClick={onOpenKb}
                className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="size-3.5" />
                No documents yet? Upload some to the knowledge base
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-7 px-4 py-8">
            {messages.map((m) => (
              <MessageView key={m.id} message={m} />
            ))}
            {pending && <ThinkingIndicator />}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring/30">
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            placeholder="Message the policy agent…"
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(input);
              }
            }}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => submit(input)}
            disabled={!input.trim() || pending}
            aria-label="Send message"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Answers are generated from your knowledge base and may be incomplete.
        </p>
      </div>
    </div>
  );
}
