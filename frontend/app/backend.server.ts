import * as crypto from 'node:crypto';

/**
 * Makes an HMAC-signed request to the backend API.
 * Uses SHOPIFY_API_SECRET to sign the request body.
 */
async function makeBackendRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
): Promise<T> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3004';
  const url = `${backendUrl}${endpoint}`;
  const secret = process.env.SHOPIFY_API_SECRET!;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    const bodyString = JSON.stringify(body);
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');

    options.headers = {
      ...options.headers,
      'x-request-hmac': hmac,
    };
    options.body = bodyString;
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(
      `Backend request failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data as T;
}

/**
 * Retrieves a config value from the backend for the given shop.
 * @param shopId - The Shopify shop domain
 * @param path - Config path (e.g., "ai_assistant.general.enable")
 */
export async function getBackendConfig(
  shopId: string,
  path: string,
): Promise<unknown> {
  return makeBackendRequest(`/config/${shopId}/${path}`);
}

/**
 * Sets a config value in the backend for the given shop.
 * @param shopId - The Shopify shop domain
 * @param path - Config path (e.g., "ai_assistant.general.enable")
 * @param value - The value to set
 */
export async function setBackendConfig(
  shopId: string,
  path: string,
  value: unknown,
): Promise<void> {
  await makeBackendRequest(`/config/${shopId}/${path}`, 'POST', { value });
}

/**
 * Retrieves all config for a given namespace from the backend.
 * @param shopId - The Shopify shop domain
 * @param namespace - Config namespace (e.g., "ai_assistant")
 */
export async function getBackendModuleConfig(
  shopId: string,
  namespace: string,
): Promise<Record<string, unknown>> {
  return makeBackendRequest(`/config/${shopId}/${namespace}`);
}

export interface ChatMessageRecord {
  id: string;
  shopId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  isError: boolean;
  createdAt: string;
}

/**
 * Fetches the chat message history for a specific shop + user.
 */
export async function getChatHistory(
  shopId: string,
  userId: string,
): Promise<ChatMessageRecord[]> {
  return makeBackendRequest<ChatMessageRecord[]>(
    `/lokte/${shopId}/history?userId=${encodeURIComponent(userId)}`,
  );
}

/**
 * Clears the chat history and Lokte session for a specific shop + user.
 */
export async function clearChatHistory(
  shopId: string,
  userId: string,
  sessionToken: string,
): Promise<void> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3004';
  const url = `${backendUrl}/lokte/${shopId}/history?userId=${encodeURIComponent(userId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  }
}
