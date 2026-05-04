import React, { useState, useCallback } from "react";
import {
  reactExtension,
  AdminAction,
  BlockStack,
  Button,
  TextField,
  Text,
  Box,
  useApi,
} from "@shopify/ui-extensions-react/admin";

// Set SHOPIFY_APP_URL to your ngrok/prod URL before deploying the extension.
// For local dev, update this to your ngrok URL.
declare const __APP_URL__: string | undefined;
const APP_URL = (typeof __APP_URL__ !== "undefined" && __APP_URL__) || "http://localhost:3000";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

let msgCounter = 0;
function nextId() {
  return String(++msgCounter);
}

function AssistantChat() {
  const { auth } = useApi("admin.product-details.action.render");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const token = await auth.idToken();
      const res = await fetch(`${APP_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ message: text }),
      });

      if (res.ok) {
        const data = (await res.json()) as { reply?: string; error?: string };
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: data.reply ?? "No response." },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: "Error: could not reach assistant." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, auth]);

  return (
    <AdminAction
      title="AI Assistant"
      primaryAction={
        <Button onPress={handleSend} disabled={!inputValue.trim() || isLoading}>
          {isLoading ? "Sending…" : "Send"}
        </Button>
      }
    >
      <BlockStack gap="base">
        {/* Message list */}
        <Box minBlockSize={200} maxBlockSize={320} padding="base">
          <BlockStack gap="small">
            {messages.length === 0 && (
              <Text>Hi! How can I help you today?</Text>
            )}
            {messages.map((msg) => (
              <Box
                key={msg.id}
                padding="small"
              >
                <Text>
                  <Text fontWeight="bold">
                    {msg.role === "user" ? "You: " : "AI: "}
                  </Text>
                  {msg.content}
                </Text>
              </Box>
            ))}
            {isLoading && (
              <Box padding="small">
                <Text>Thinking…</Text>
              </Box>
            )}
          </BlockStack>
        </Box>

        {/* Input */}
        <TextField
          label="Message"
          value={inputValue}
          onChange={setInputValue}
          placeholder="Ask anything…"
          disabled={isLoading}
        />
      </BlockStack>
    </AdminAction>
  );
}

export default reactExtension(
  "admin.product-details.action.render",
  () => <AssistantChat />,
);

export const orderAction = reactExtension(
  "admin.order-details.action.render",
  () => <AssistantChat />,
);

export const customerAction = reactExtension(
  "admin.customer-details.action.render",
  () => <AssistantChat />,
);
