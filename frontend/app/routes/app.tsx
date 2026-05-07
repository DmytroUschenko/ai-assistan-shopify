import { Outlet, useLoaderData } from "@remix-run/react";
import { authenticate } from "~/shopify.server";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { AppProvider } from "@shopify/shopify-app-remix/react";

console.log("[app.tsx] module loading...");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("[app.tsx] loader called:", request.url);
  try {
    await authenticate.admin(request);
    console.log("[app.tsx] authenticate.admin succeeded");
  } catch (err) {
    console.error("[app.tsx] authenticate.admin threw:", err);
    throw err;
  }

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <ui-nav-menu>
        <a href="/app" rel="home">AI Assistant</a>
        <a href="/app/configuration">Configuration</a>
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}
