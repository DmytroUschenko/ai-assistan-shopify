import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let message = "";
  let sessionToken = "";
  try {
    const body = await request.json() as { message?: unknown; sessionToken?: unknown };
    message = typeof body?.message === "string" ? body.message : "";
    sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken : "";
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!message.trim()) {
    return json({ error: "message is required" }, { status: 400 });
  }

  if (!sessionToken) {
    return json({ error: "sessionToken is required" }, { status: 400 });
  }

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3004";
  const shopId = session.shop;

  // ── Dev / Testing flags ─────────────────────────────────────────────────────
  // These come from the Dev / Testing section in the Configuration UI.
  // They are only registered in non-production (NODE_ENV !== 'production').
  // In production the fetch returns {} and both flags stay false.
  let devForceError = false;
  let devForceNotConfigured = false;
  try {
    const devRes = await fetch(`${backendUrl}/config/${shopId}/dev_testing`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (devRes.ok) {
      const devCfg = await devRes.json() as { general?: { force_error?: unknown; force_not_configured?: unknown } };
      devForceError = Number(devCfg?.general?.force_error) === 1;
      devForceNotConfigured = Number(devCfg?.general?.force_not_configured) === 1;
    }
  } catch { /* non-production only — ignore gracefully */ }

  if (devForceNotConfigured) {
    return json(
      { error: "Lokte is not configured for this shop. Please complete the setup in Configuration." },
      { status: 503 },
    );
  }
  if (devForceError) {
    return json(
      { error: "Something went wrong on the server. Please try again." },
      { status: 500 },
    );
  }
  // ────────────────────────────────────────────────────────────────────────────

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/lokte/${shopId}/question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ question: message }),
    });
  } catch {
    return json(
      { error: "Could not reach the AI backend. Please try again." },
      { status: 502 },
    );
  }

  if (!response.ok) {
    if (response.status === 503) {
      return json(
        {
          error:
            "Lokte is not configured for this shop. Please complete the setup in Configuration.",
        },
        { status: 503 },
      );
    }
    return json(
      { error: "Something went wrong. Please try again." },
      { status: response.status },
    );
  }

  const data = await response.json() as { answer?: unknown };
  return json({ reply: String(data.answer ?? "") });
};
