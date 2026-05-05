import * as crypto from 'node:crypto';

/**
 * Makes a request to the backend API.
 *
 * - When `body` is provided (POST/PUT/DELETE), signs the payload with HMAC-SHA256
 *   using SHOPIFY_API_SECRET and includes it as `x-request-hmac`.
 * - When `sessionToken` is provided, passes it as `Authorization: Bearer <token>`
 *   for endpoints protected by ShopifySessionGuard.
 */
async function makeBackendRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>,
  sessionToken?: string,
): Promise<T> {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const url = `${backendUrl}${endpoint}`;
  const secret = process.env.SHOPIFY_API_SECRET!;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const options: RequestInit = { method, headers };

  if (body) {
    const bodyString = JSON.stringify(body);
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');
    headers['x-request-hmac'] = hmac;
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
 * @param sessionToken - Shopify session JWT for ShopifySessionGuard auth
 */
export async function getBackendConfig(
  shopId: string,
  path: string,
  sessionToken?: string,
): Promise<unknown> {
  return makeBackendRequest(`/config/${shopId}/${path}`, 'GET', undefined, sessionToken);
}

/**
 * Sets a config value in the backend for the given shop.
 * @param shopId - The Shopify shop domain
 * @param path - Config path (e.g., "ai_assistant.general.enable")
 * @param value - The value to set
 * @param sessionToken - Shopify session JWT for ShopifySessionGuard auth
 */
export async function setBackendConfig(
  shopId: string,
  path: string,
  value: unknown,
  sessionToken?: string,
): Promise<void> {
  await makeBackendRequest(
    `/config/${shopId}`,
    'POST',
    { path, value },
    sessionToken,
  );
}

/**
 * Retrieves all config for a given namespace from the backend.
 * @param shopId - The Shopify shop domain
 * @param namespace - Config namespace (e.g., "ai_assistant")
 * @param sessionToken - Shopify session JWT for ShopifySessionGuard auth
 */
export async function getBackendModuleConfig(
  shopId: string,
  namespace: string,
  sessionToken?: string,
): Promise<Record<string, unknown>> {
  return makeBackendRequest(`/config/${shopId}/${namespace}`, 'GET', undefined, sessionToken);
}

/**
 * Retrieves the full config schema (FE rendering metadata) for all namespaces.
 * @param sessionToken - Shopify session JWT for ShopifySessionGuard auth
 */
export async function getBackendSchema(
  sessionToken: string,
): Promise<Record<string, unknown>> {
  return makeBackendRequest('/config/schema', 'GET', undefined, sessionToken);
}

/**
 * Retrieves the merged config for all namespaces for the given shop.
 * @param shopId - The Shopify shop domain
 * @param sessionToken - Shopify session JWT for ShopifySessionGuard auth
 */
export async function getAllBackendConfig(
  shopId: string,
  sessionToken: string,
): Promise<Record<string, unknown>> {
  return makeBackendRequest(`/config/${shopId}`, 'GET', undefined, sessionToken);
}

/**
 * Sends a question to the Lokte AI and returns the answer.
 * For future use when a chat UI is added.
 * @param sessionToken - Shopify session JWT for ShopifySessionGuard auth
 */
export async function askQuestion(
  sessionToken: string,
  message: string,
): Promise<{ answer: string }> {
  return makeBackendRequest('/question', 'POST', { message }, sessionToken);
}
