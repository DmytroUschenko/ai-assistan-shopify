import React, { useRef, useEffect } from "react";
import { Button, TextField, Text, Spinner } from "@shopify/polaris";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatSidebar({
  isOpen,
  messages,
  inputValue,
  isLoading,
  onClose,
  onInputChange,
  onSend,
}: ChatSidebarProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(0,0,0,0.3)",
          }}
        />
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100%",
          width: "380px",
          maxWidth: "100vw",
          zIndex: 9999,
          background: "#fff",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid #e1e3e5",
            flexShrink: 0,
          }}
        >
          <Text variant="headingMd" as="h2">
            AI Assistant
          </Text>
          <Button
            variant="plain"
            onClick={onClose}
            accessibilityLabel="Close AI Assistant"
          >
            ✕
          </Button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", marginTop: "40px" }}>
              <Text variant="bodyMd" as="p" tone="subdued">
                Hi! How can I help you today?
              </Text>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user" ? "#008060" : "#f1f2f3",
                  color: msg.role === "user" ? "#fff" : "#202223",
                  fontSize: "14px",
                  lineHeight: "1.5",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "#f1f2f3",
                }}
              >
                <Spinner size="small" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid #e1e3e5",
            flexShrink: 0,
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
          }}
          onKeyDown={handleKeyDown}
        >
          <div style={{ flex: 1 }}>
            <TextField
              label=""
              labelHidden
              value={inputValue}
              onChange={onInputChange}
              placeholder="Ask anything…"
              multiline={2}
              autoComplete="off"
              disabled={isLoading}
            />
          </div>
          <Button
            variant="primary"
            onClick={onSend}
            disabled={!inputValue.trim() || isLoading}
            accessibilityLabel="Send message"
          >
            Send
          </Button>
        </div>
      </div>
    </>
  );
}
