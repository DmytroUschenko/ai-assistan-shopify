import React, { useState, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import { FloatingButton } from "./FloatingButton";
import { ChatSidebar, type ChatMessage } from "./ChatSidebar";

type ChatApiResponse = { reply: string } | { error: string };

let messageIdCounter = 0;
function nextId() {
  return String(++messageIdCounter);
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const fetcher = useFetcher<ChatApiResponse>();

  const isLoading = fetcher.state !== "idle";

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    fetcher.submit(
      JSON.stringify({ message: text }),
      {
        method: "POST",
        action: "/api/chat",
        encType: "application/json",
      }
    );
  }, [inputValue, isLoading, fetcher]);

  // Append assistant reply when fetcher resolves
  React.useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data as ChatApiResponse;
      if ("reply" in data) {
        const assistantMsg: ChatMessage = {
          id: nextId(),
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <>
      {!isOpen && (
        <FloatingButton onClick={() => setIsOpen(true)} />
      )}
      <ChatSidebar
        isOpen={isOpen}
        messages={messages}
        inputValue={inputValue}
        isLoading={isLoading}
        onClose={() => setIsOpen(false)}
        onInputChange={setInputValue}
        onSend={handleSend}
      />
    </>
  );
}
