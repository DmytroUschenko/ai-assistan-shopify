import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
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

  // TODO: replace with real NestJS AI backend call
  const reply = `[Mock AI] You said: "${message}". Real responses coming soon.`;

  return json({ reply });
};
