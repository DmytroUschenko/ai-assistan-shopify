import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

console.log("[_index.tsx] module loading...");

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log("[_index.tsx] loader called, redirecting to /app with search:", url.search);
  // Preserve Shopify query params (shop, host, hmac, etc.)
  return redirect(`/app${url.search}`);
};
