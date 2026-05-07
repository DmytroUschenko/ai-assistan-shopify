import { useState, useCallback, useRef, useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { Spinner } from "@shopify/polaris";
import { assistantTheme as theme } from "~/styles/assistant-theme";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
}

type ChatApiResponse = { reply: string } | { error: string };

interface SuggestedQuestion {
  question: string;
  label: string;
}

// Hardcoded for now — future: fetch from backend per shop
const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    question: "What are my top-selling products this month?",
    label: "Product insights",
  },
  {
    question: "Show me recent orders that need attention.",
    label: "Order management",
  },
  {
    question: "How can I improve my store's conversion rate?",
    label: "Store optimization",
  },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const fetcher = useFetcher<ChatApiResponse>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaFocused, setTextareaFocused] = useState(false);

  const isLoading = fetcher.state !== "idle";
  const hasMessages = messages.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, theme.sizes.textareaMaxHeight)}px`;
  }, [inputValue]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: trimmed },
      ]);
      setInputValue("");

      // fetcher is intentionally omitted from deps — useFetcher() returns a stable reference in Remix v2
      fetcher.submit(JSON.stringify({ message: trimmed }), {
        method: "POST",
        action: "/api/chat",
        encType: "application/json",
      });
    },
    [isLoading], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleSend = useCallback(() => {
    sendMessage(inputValue);
  }, [inputValue, sendMessage]);

  // Append assistant reply (or error) when fetcher resolves
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      const data = fetcher.data;
      if ("reply" in data) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply },
        ]);
      } else if ("error" in data) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.error, isError: true },
        ]);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  function renderInputBox() {
    return (
      <div
        style={{
          background: theme.colors.surface,
          border: textareaFocused
            ? `1px solid ${theme.colors.brand}`
            : `1px solid ${theme.colors.border}`,
          borderRadius: theme.radius.input,
          boxShadow: textareaFocused
            ? theme.shadows.inputFocus
            : theme.shadows.input,
          overflow: "hidden",
          transition: `border-color ${theme.transitions.fast}, box-shadow ${theme.transitions.fast}`,
        }}
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          placeholder="How can AI Assistant help you today?"
          rows={1}
          style={{
            display: "block",
            width: "100%",
            padding: theme.spacing.inputPadding,
            border: "none",
            outline: "none",
            resize: "none",
            fontSize: theme.typography.base,
            lineHeight: "1.5",
            color: theme.colors.textPrimary,
            background: "transparent",
            fontFamily: "inherit",
            overflowY: "auto",
            boxSizing: "border-box",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: theme.spacing.inputFooterPadding,
            gap: theme.spacing.sm,
          }}
        >
          <span
            style={{
              fontSize: theme.typography.small,
              color: theme.colors.textMuted,
              marginRight: "auto",
              userSelect: "none",
            }}
          >
            ↵ Enter to send&nbsp;&nbsp;·&nbsp;&nbsp;Shift+Enter for new line
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
            style={{
              width: theme.sizes.sendButton,
              height: theme.sizes.sendButton,
              borderRadius: theme.radius.round,
              border: "none",
              background:
                !inputValue.trim() || isLoading
                  ? theme.colors.disabled
                  : theme.colors.brand,
              cursor:
                !inputValue.trim() || isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: `background ${theme.transitions.fast}`,
              flexShrink: 0,
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={theme.sizes.sendIcon}
              height={theme.sizes.sendIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.colors.white}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: `calc(100vh - ${theme.sizes.pageOffset})`,
        background: theme.colors.pageBackground,
        fontFamily: theme.typography.fontFamily,
        color: theme.colors.textPrimary,
      }}
    >
      {/* ── Chat header — only shown in active conversation ── */}
      {hasMessages && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: theme.spacing.sm,
            padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
            borderBottom: `1px solid ${theme.colors.borderSubtle}`,
            background: theme.colors.surface,
          }}
        >
          <button
            type="button"
            onClick={() => setMessages([])}
            aria-label="New conversation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.xs,
              padding: `6px ${theme.spacing.sm}`,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.radius.button,
              background: "transparent",
              color: theme.colors.textSecondary,
              fontSize: theme.typography.small,
              cursor: "pointer",
              transition: `background ${theme.transitions.fast}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                theme.colors.suggestionHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            New conversation
          </button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.sm,
              marginLeft: "auto",
            }}
          >
            <img
              src="/assets/logo.png"
              alt="AI Assistant"
              style={{
                width: theme.sizes.avatar,
                height: theme.sizes.avatar,
                borderRadius: theme.radius.button,
                objectFit: "contain",
              }}
            />
            <span
              style={{
                fontSize: theme.typography.small,
                fontWeight: 500,
                color: theme.colors.textPrimary,
              }}
            >
              AI Assistant
            </span>
          </div>
        </div>
      )}

      {/* ── Scrollable messages (or centered empty state) ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {!hasMessages ? (
          /* ── Empty state: 3-row grid matching expected layout ── */
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateRows: "0.85fr auto 1.15fr",
              width: "100%",
              maxWidth: theme.sizes.maxContentWidth,
              margin: "0 auto",
              padding: `0 ${theme.spacing.lg}`,
              height: "100%",
            }}
          >
            {/* Row 1 — greeting aligned to bottom of its row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: theme.spacing.xxl,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: theme.spacing.lg,
                }}
              >
                <img
                  src="/assets/logo.png"
                  alt="AI Assistant logo"
                  style={{
                    width: theme.sizes.logo,
                    height: theme.sizes.logo,
                    borderRadius: theme.radius.input,
                    objectFit: "contain",
                    flexShrink: 0,
                  }}
                />
                <h1
                  style={{
                    fontSize: theme.typography.heading,
                    fontWeight: 500,
                    margin: 0,
                    color: theme.colors.textPrimary,
                    lineHeight: 1.3,
                    maxWidth: theme.sizes.greetingMaxWidth,
                  }}
                >
                  What would you like to{" "}
                  <span style={{ color: theme.colors.brand }}>explore</span> today?
                </h1>
              </div>
            </div>

            {/* Row 2 — input */}
            <div>{renderInputBox()}</div>

            {/* Row 3 — suggested questions */}
            <div style={{ marginTop: theme.spacing.xl }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: theme.spacing.xxs,
                }}
              >
                {SUGGESTED_QUESTIONS.map((sq) => (
                  <button
                    key={sq.question}
                    type="button"
                    onClick={() => sendMessage(sq.question)}
                    style={{
                      textAlign: "left",
                      fontSize: theme.typography.body,
                      margin: `0 ${theme.spacing.xxl}`,
                      padding: `10px ${theme.spacing.md}`,
                      borderRadius: theme.radius.button,
                      border: "none",
                      background: "transparent",
                      color: theme.colors.textSecondary,
                      cursor: "pointer",
                      transition: `background ${theme.transitions.fast}`,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        theme.colors.suggestionHover;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "transparent";
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        color: theme.colors.textPrimary,
                        lineHeight: 1.4,
                      }}
                    >
                      {sq.question}
                    </div>
                    <div
                      style={{
                        fontSize: theme.typography.small,
                        color: theme.colors.textMuted,
                        marginTop: theme.spacing.xxs,
                      }}
                    >
                      →&nbsp;&nbsp;{sq.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Active conversation ── */
          <div
            style={{
              flex: 1,
              maxWidth: theme.sizes.maxContentWidth,
              width: "100%",
              margin: "0 auto",
              padding: theme.spacing.conversationPadding,
              display: "flex",
              flexDirection: "column",
              gap: theme.spacing.lg,
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: msg.role === "user" ? "column" : "row",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: theme.spacing.sm,
                }}
              >
                {/* Logo avatar — left side of assistant messages */}
                {msg.role === "assistant" && (
                  <img
                    src="/assets/logo.png"
                    alt="AI Assistant"
                    style={{
                      width: theme.sizes.avatar,
                      height: theme.sizes.avatar,
                      borderRadius: theme.radius.button,
                      objectFit: "contain",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  />
                )}

                <div style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: theme.sizes.bubbleMaxWidth,
                      padding: `10px ${theme.spacing.lg}`,
                      borderRadius:
                        msg.role === "user"
                          ? theme.radius.bubbleUser
                          : theme.radius.bubbleAssistant,
                      background: msg.isError
                        ? theme.colors.errorBg
                        : msg.role === "user"
                        ? theme.colors.brand
                        : theme.colors.surface,
                      color: msg.isError
                        ? theme.colors.errorText
                        : msg.role === "user"
                        ? theme.colors.white
                        : theme.colors.textPrimary,
                      border: msg.isError
                        ? `1px solid ${theme.colors.errorBorder}`
                        : "none",
                      fontSize: theme.typography.body,
                      lineHeight: 1.5,
                      boxShadow: msg.isError ? "none" : theme.shadows.bubble,
                    }}
                  >
                    {msg.isError && (
                      <span style={{ marginRight: theme.spacing.xs }}>⚠️</span>
                    )}
                    {msg.content}
                  </div>
                  <span
                    style={{
                      marginTop: theme.spacing.xs,
                      fontSize: theme.typography.tiny,
                      color: msg.isError ? theme.colors.errorText : theme.colors.textMuted,
                    }}
                  >
                    {msg.role === "user" ? "You" : msg.isError ? "Error" : "AI Assistant"}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: theme.spacing.sm,
                }}
              >
                <img
                  src="/assets/logo.png"
                  alt="AI Assistant"
                  style={{
                    width: theme.sizes.avatar,
                    height: theme.sizes.avatar,
                    borderRadius: theme.radius.button,
                    objectFit: "contain",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                    padding: `10px ${theme.spacing.lg}`,
                    borderRadius: theme.radius.bubbleAssistant,
                    background: theme.colors.surface,
                    boxShadow: theme.shadows.bubble,
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.body,
                  }}
                >
                  <Spinner size="small" />
                  Thinking…
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Sticky input bar — only shown once conversation starts ── */}
      {hasMessages && (
        <div
          style={{
            flexShrink: 0,
            padding: theme.spacing.stickyInputPadding,
            background: theme.colors.pageBackground,
            borderTop: `1px solid ${theme.colors.borderSubtle}`,
          }}
        >
          <div style={{ maxWidth: theme.sizes.maxContentWidth, margin: "0 auto" }}>
            {renderInputBox()}
          </div>
        </div>
      )}
    </div>
  );
}
