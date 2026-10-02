"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, ChevronDown, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Citation, Message } from "@/lib/types";

function Citations({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  const sources = Array.from(new Set(citations.map((c) => c.source)));

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <FileText className="size-3.5" />
        {citations.length} {citations.length === 1 ? "source" : "sources"} ·{" "}
        {sources.join(", ")}
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {citations.map((c) => (
            <li
              key={`${c.source}-${c.chunkId}`}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs"
            >
              <div className="mb-1 font-medium">
                {c.source}{" "}
                <span className="font-normal text-muted-foreground">
                  · chunk {c.chunkId}
                </span>
              </div>
              <p className="line-clamp-4 text-muted-foreground">{c.preview}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MessageView({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-[15px] leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
          message.error
            ? "bg-destructive/15 text-destructive"
            : "bg-primary text-primary-foreground",
        )}
      >
        {message.error ? (
          <AlertCircle className="size-4" />
        ) : (
          <Sparkles className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {message.error ? (
          <p className="text-[15px] text-destructive">{message.content}</p>
        ) : (
          <div className="prose prose-neutral dark:prose-invert max-w-none text-[15px] prose-p:leading-relaxed prose-pre:bg-secondary prose-pre:text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.citations && message.citations.length > 0 && (
          <Citations citations={message.citations} />
        )}
      </div>
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-4 animate-pulse" />
      </div>
      <div className="flex items-center gap-1 py-2">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
