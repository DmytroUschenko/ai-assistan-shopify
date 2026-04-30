import * as crypto from "node:crypto";
import { shopifyApp } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { prisma } from "./db.server";

console.log("[shopify.server] module loading...");
console.log("[shopify.server] prisma imported:", typeof prisma);

console.log("[shopify.server] ENV check:", {
  apiKey: !!process.env.SHOPIFY_API_KEY,
  secret: !!process.env.SHOPIFY_API_SECRET,
  appUrl: process.env.APP_URL,
  scopes: process.env.SCOPES,
});

export const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY!,
  apiSecretKey: process.env.SHOPIFY_API_SECRET!,
  scopes: process.env.SCOPES!.split(","),
  appUrl: process.env.APP_URL!,
  sessionStorage: new PrismaSessionStorage(prisma),
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  hooks: {
    afterAuth: async ({ session }) => {
      console.log("[shopify.server] afterAuth hook triggered for shop:", session.shop); 
      // 1. Upsert shop in local DB
      try {
        await prisma.shop.upsert({
          where: { shopDomain: session.shop },
          create: { shopDomain: session.shop },
          update: {},
        });
      } catch (err) {
        console.error("[shopify.server] Failed to upsert shop in local DB:", err);
      }

      // 2. Notify backend of new/returning shop
      try {
        const bodyString = JSON.stringify({
          shopDomain: session.shop,
          accessToken: session.accessToken,
          scope: session.scope,
        });
        const hmac = crypto
          .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
          .update(bodyString, "utf8")
          .digest("base64");
        const response = await fetch(`${process.env.BACKEND_URL}/shops`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-hmac": hmac,
          },
          body: bodyString,
        });
        if (!response.ok) {
          console.error(
            `Backend shop registration failed: ${response.status} ${response.statusText}`
          );
        }
      } catch (err) {
        console.error("Failed to notify backend after OAuth:", err);
      }
    },
  },
});

export const authenticate = shopify.authenticate;
export const sessionStorage = shopify.sessionStorage;
console.log("[shopify.server] module ready — shopify, authenticate, sessionStorage exported");
