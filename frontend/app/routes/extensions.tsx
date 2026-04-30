import { json } from "@remix-run/node";

// Shopify App Bridge requests /extensions when loading the embedded app.
// Since this app has no extensions, return an empty array.
export const loader = async () => {
  return json([]);
};
