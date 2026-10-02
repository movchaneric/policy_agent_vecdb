"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, X, XCircle } from "lucide-react";
import { uploadDocument } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UploadResult {
  name: string;
  status: "uploading" | "done" | "error";
  detail?: string;
}

const ACCEPT = ".pdf,.txt,.md";

export function KbDialog({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const patch = (r: Partial<UploadResult>) =>
        setResults((prev) =>
          prev.map((p) => (p.name === file.name ? { ...p, ...r } : p)),
        );
      setResults((prev) => [
        ...prev.filter((p) => p.name !== file.name),
        { name: file.name, status: "uploading" },
      ]);
      try {
        const summary = await uploadDocument(file);
        patch({
          status: "done",
          detail: `${summary.totalChunks} chunks indexed`,
        });
      } catch (err) {
        patch({
          status: "error",
          detail: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Knowledge base"
        className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-serif text-xl">Knowledge base</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Upload PDF, text or markdown files. The agent searches them when you
          ask about their content.
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-8 text-center transition-colors hover:bg-accent",
            dragging && "border-primary bg-accent",
          )}
        >
          <FileUp className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">
            Drop files here or click to browse
          </span>
          <span className="text-xs text-muted-foreground">
            .pdf, .txt, .md · up to 10 MB
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {results.length > 0 && (
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={r.name} className="flex items-start gap-2 text-sm">
                {r.status === "uploading" && (
                  <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                )}
                {r.status === "done" && (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                )}
                {r.status === "error" && (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <div className="truncate">{r.name}</div>
                  <div
                    className={cn(
                      "text-xs",
                      r.status === "error"
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {r.status === "uploading" ? "Embedding and indexing…" : r.detail}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
