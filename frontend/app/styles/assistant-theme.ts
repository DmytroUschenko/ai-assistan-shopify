/**
 * App-specific theme values for the AI Assistant chat UI.
 *
 * All standard colours use Polaris design tokens (var(--p-color-*)) so the
 * UI automatically respects the Shopify admin light / dark / high-contrast
 * themes. Only values that have no Polaris equivalent are hardcoded.
 */
export const assistantTheme = {
  colors: {
    /** Amber brand colour — not part of the Polaris palette. */
    brand: "#eab308",
    link: "#b77900",
    linkHover: "#92400e",
    pageBackground: "var(--p-color-bg, #f6f6f7)",
    surface: "var(--p-color-bg-surface, #ffffff)",
    border: "var(--p-color-border, #c9cccf)",
    borderSubtle: "var(--p-color-border-secondary, #e1e3e5)",
    textPrimary: "var(--p-color-text, #525252)",
    textSecondary: "var(--p-color-text-secondary, #6d7175)",
    textMuted: "var(--p-color-text-disabled, #8c9196)",
    disabled: "var(--p-color-bg-fill-disabled, #c9cccf)",
    suggestionHover: "var(--p-color-bg-surface-hover, #ebebeb)",
    /** White text on brand-coloured (amber) backgrounds. */
    white: "#ffffff",
    focusRing: "rgba(0,128,96,0.12)",
    errorText: "var(--p-color-text-critical, #b91c1c)",
    errorBg: "var(--p-color-bg-surface-critical, #fef2f2)",
    errorBorder: "var(--p-color-border-critical, #fca5a5)",
  },
  typography: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, sans-serif",
    heading: "30px",
    base: "15px",
    body: "14px",
    small: "12px",
    tiny: "11px",
  },
  spacing: {
    xxs: "2px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "28px",
    inputPadding: "16px 18px 10px",
    inputFooterPadding: "6px 14px 12px",
    stickyInputPadding: "12px 16px 20px",
    conversationPadding: "24px 16px 8px",
  },
  radius: {
    input: "12px",
    button: "8px",
    round: "50%",
    bubbleUser: "18px 18px 4px 18px",
    bubbleAssistant: "18px 18px 18px 4px",
  },
  sizes: {
    /**
     * Height of the App Bridge embedded nav bar (<ui-nav-menu>).
     * Polaris does not expose a CSS variable for this offset.
     * Update here if App Bridge changes the nav bar height.
     */
    pageOffset: "56px",
    maxContentWidth: "790px",
    greetingMaxWidth: "440px",
    logo: 48,
    avatar: 28,
    sendButton: "32px",
    sendIcon: "16",
    textareaMaxHeight: 160,
    bubbleMaxWidth: "80%",
  },
  shadows: {
    input: "0 2px 8px rgba(0,0,0,0.07)",
    inputFocus: "0 0 0 3px rgba(0,128,96,0.12)",
    bubble: "0 1px 3px rgba(0,0,0,0.08)",
  },
  transitions: {
    fast: "0.15s",
  },
} as const;
