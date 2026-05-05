import { useState, useCallback } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Layout, BlockStack, Banner, Text } from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import {
  getBackendSchema,
  getAllBackendConfig,
  setBackendConfig,
} from "~/backend.server";
import { ConfigModule } from "~/components/ConfigModule";
import type { ConfigNamespaceMeta } from "~/components/ConfigModule";

// ---------------------------------------------------------------------------
// Loader — fetch schema + all config values
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Extract session token from Authorization header for ShopifySessionGuard
  const sessionToken =
    request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

  try {
    const [schema, config] = await Promise.all([
      getBackendSchema(sessionToken),
      getAllBackendConfig(session.shop, sessionToken),
    ]);
    return json({ schema, config, error: null });
  } catch (error) {
    console.error("Failed to load config:", error);
    return json({ schema: {}, config: {}, error: "Failed to load settings" });
  }
};

// ---------------------------------------------------------------------------
// Action — save a single field value
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);
  const sessionToken =
    request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const formData = await request.formData();

  const path = formData.get("path") as string;
  const rawValue = formData.get("value") as string;
  const valueType = formData.get("valueType") as string;

  if (!path) {
    return json({ error: "Missing path" }, { status: 400 });
  }

  // Don't save if user left an encrypted field blank (preserve existing value)
  if (valueType === "encrypted" && rawValue === "") {
    return json({ saved: true, path });
  }

  // Coerce value to the right type
  let value: unknown = rawValue;
  if (valueType === "boolean") value = rawValue === "true";
  else if (valueType === "number") value = rawValue === "" ? null : Number(rawValue);

  try {
    await setBackendConfig(session.shop, path, value, sessionToken);
    return json({ saved: true, path });
  } catch (error) {
    console.error("Failed to save config:", error);
    return json({ error: "Failed to save setting" }, { status: 500 });
  }
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { schema, config, error } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(
    config as Record<string, unknown>,
  );
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const handleChange = useCallback(
    (path: string, value: unknown) => {
      // Optimistic local update
      const [namespace, ...rest] = path.split(".");
      setLocalConfig((prev) => {
        const ns = (prev[namespace] as Record<string, unknown>) ?? {};
        return { ...prev, [namespace]: setNestedValue({ ...ns }, rest, value) };
      });

      // Determine value type hint for the action
      let valueType = "string";
      if (typeof value === "boolean") valueType = "boolean";
      else if (typeof value === "number") valueType = "number";

      // Detect encrypted fields
      const schemaNs = (schema as Record<string, ConfigNamespaceMeta>)[namespace];
      const subPath = rest.join(".");
      if (schemaNs?.fields[subPath]?.fieldType === "encrypted") {
        valueType = "encrypted";
      }

      const formData = new FormData();
      formData.set("path", path);
      formData.set("value", String(value));
      formData.set("valueType", valueType);

      setSavedPath(path);
      submit(formData, { method: "post" });
    },
    [schema, submit],
  );

  const namespaces = Object.keys(schema as Record<string, ConfigNamespaceMeta>);

  return (
    <Page
      title="AI Assistant"
      subtitle="Configure AI Assistant features for your store"
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error && (
              <Banner tone="critical">
                <Text as="p">{error}</Text>
              </Banner>
            )}

            {namespaces.length === 0 && !error && (
              <Banner tone="info">
                <Text as="p">No configuration available.</Text>
              </Banner>
            )}

            {namespaces.map((namespace) => {
              const meta = (schema as Record<string, ConfigNamespaceMeta>)[namespace];
              const values =
                (localConfig[namespace] as Record<string, unknown>) ?? {};
              return (
                <ConfigModule
                  key={namespace}
                  namespace={namespace}
                  meta={meta}
                  values={values}
                  onChange={handleChange}
                />
              );
            })}

            {navigation.state === "submitting" && savedPath && (
              <Text as="p" tone="subdued">
                Saving…
              </Text>
            )}
            {navigation.state === "idle" && savedPath && (
              <Text as="p" tone="success">
                ✓ Settings saved
              </Text>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Helper: deep-set a value at a dot-path within a nested object
// ---------------------------------------------------------------------------

function setNestedValue(
  obj: Record<string, unknown>,
  keys: string[],
  value: unknown,
): Record<string, unknown> {
  if (keys.length === 1) {
    return { ...obj, [keys[0]]: value };
  }
  const [head, ...tail] = keys;
  const nested = (obj[head] as Record<string, unknown>) ?? {};
  return { ...obj, [head]: setNestedValue({ ...nested }, tail, value) };
}
