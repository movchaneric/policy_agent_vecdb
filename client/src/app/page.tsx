"use client";

import { useState, useSyncExternalStore } from "react";
import { Chat } from "@/components/chat";
import { KbDialog } from "@/components/kb-dialog";
import { Sidebar } from "@/components/sidebar";
import {
  deleteChat,
  getServerSnapshot,
  getSnapshot,
  newChat,
  selectChat,
  subscribe,
} from "@/lib/store";

export default function Home() {
  const { conversations, activeId, pendingIds } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          newChat();
          setSidebarOpen(false);
        }}
        onSelect={(id) => {
          selectChat(id);
          setSidebarOpen(false);
        }}
        onDelete={deleteChat}
        onOpenKb={() => {
          setKbOpen(true);
          setSidebarOpen(false);
        }}
      />
      <main className="min-w-0 flex-1">
        <Chat
          conversation={active}
          pending={activeId !== null && pendingIds.includes(activeId)}
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenKb={() => setKbOpen(true)}
        />
      </main>
      {kbOpen && <KbDialog onClose={() => setKbOpen(false)} />}
    </div>
  );
}
