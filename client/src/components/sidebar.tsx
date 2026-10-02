"use client";

import {
  BookOpen,
  Moon,
  PanelLeftClose,
  Plus,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // theme just won't persist
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}

export function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNewChat,
  onSelect,
  onDelete,
  onOpenKb,
}: {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenKb: () => void;
}) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="font-serif text-lg tracking-tight">
              Policy Agent
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="rounded-md p-1.5 hover:bg-sidebar-accent md:hidden"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        <div className="space-y-1 px-3 py-2">
          <button
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-sidebar-accent"
          >
            <Plus className="size-4" />
            New chat
          </button>
          <button
            onClick={onOpenKb}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
          >
            <BookOpen className="size-4" />
            Knowledge base
          </button>
        </div>

        <div className="px-6 pb-1 pt-3 text-xs font-medium text-muted-foreground">
          Recents
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {sorted.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Your conversations will show up here.
            </p>
          )}
          {sorted.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center rounded-lg transition-colors hover:bg-sidebar-accent",
                c.id === activeId && "bg-sidebar-accent",
              )}
            >
              <button
                onClick={() => onSelect(c.id)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
              >
                {c.title}
              </button>
              <button
                onClick={() => onDelete(c.id)}
                aria-label={`Delete ${c.title}`}
                className="mr-1 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            Policy knowledge base
          </span>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
