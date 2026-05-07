import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

// ─────────────────────────────────────────────────────────────────
// MOCK CONFIGURATION — remove / replace when wiring the real backend
// ─────────────────────────────────────────────────────────────────

/** MOCK: simulated thinking delay range in milliseconds */
const MOCK_DELAY_MIN_MS = 1_000;
const MOCK_DELAY_MAX_MS = 10_000;

/** MOCK: probability (0–1) of returning an error instead of a reply */
const MOCK_ERROR_RATE = 0.25;

const MOCK_ERRORS = [
  "Something went wrong on the server. Please try again.",
  "The AI service is temporarily unavailable. Retry in a moment.",
  "Request timed out while contacting the AI backend.",
];

const MOCK_REPLIES = [
  "Here are your top-selling products this month: Wireless Headphones (142 units), Running Shoes (98 units), and Yoga Mat (76 units).",
  "You have 3 orders that need attention: #1042 (payment failed), #1055 (fulfillment delayed), and #1067 (address unverifiable).",
  "To improve conversion rate: add trust badges at checkout, reduce form fields, and enable shop-pay. Your current rate is 2.4%; industry average is 3.1%.",
  "I found 5 abandoned carts in the last 24 hours totalling $312. Would you like me to draft a recovery email?",
  "Your best-performing discount campaign last month was SUMMER20 with a 34% redemption rate and $1,840 in attributed revenue.",
];

// ─────────────────────────────────────────────────────────────────

function mockDelay(): Promise<void> {
  const ms =
    MOCK_DELAY_MIN_MS +
    Math.floor(Math.random() * (MOCK_DELAY_MAX_MS - MOCK_DELAY_MIN_MS));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let message = "";
  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message : "";
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message.trim()) {
    return json({ error: "message is required" }, { status: 400 });
  }

  // MOCK: simulate the time a real AI backend would take to respond
  await mockDelay();

  // MOCK: randomly surface an error so the error UI can be tested
  if (Math.random() < MOCK_ERROR_RATE) {
    const error = MOCK_ERRORS[Math.floor(Math.random() * MOCK_ERRORS.length)];
    return json({ error }, { status: 500 });
  }

  const reply = MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
  return json({ reply });
};
