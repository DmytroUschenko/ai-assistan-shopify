import { authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";

console.log("[auth.$.tsx] module loading...");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[auth.$.tsx] loader called:", request.url);
  await authenticate.admin(request);
  return null;
};
