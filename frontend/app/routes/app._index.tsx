import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  SettingToggle,
  Text,
} from "@shopify/polaris";
import { authenticate } from "~/shopify.server";
import {
  getBackendConfig,
  setBackendConfig,
} from "~/backend.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const enabled = await getBackendConfig(
      session.shop,
      "ai_assistant.general.enable",
    );
    return json({ enabled: !!enabled });
  } catch (error) {
    console.error("Failed to load AI Assistant config:", error);
    return json({ enabled: true }); // Default to enabled on error
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const enabled = formData.get("enabled") === "true";

  try {
    await setBackendConfig(
      session.shop,
      "ai_assistant.general.enable",
      enabled,
    );
    return json({ success: true, enabled });
  } catch (error) {
    console.error("Failed to update AI Assistant config:", error);
    return json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
};

export default function Index() {
  const { enabled } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page
      title="AI Assistant"
      subtitle="Configure AI Assistant features for your store"
    >
      <Layout>
        <Layout.Section>
          <Card>
            <Form method="post">
              <SettingToggle
                action={{
                  content: enabled ? "Disable" : "Enable",
                  onAction: () => {
                    const form = document.querySelector("form");
                    if (form) {
                      const input = form.querySelector(
                        'input[name="enabled"]',
                      ) as HTMLInputElement;
                      if (input) {
                        input.value = (!enabled).toString();
                        form.submit();
                      }
                    }
                  },
                }}
                enabled={enabled}
              >
                <div style={{ marginBottom: "1rem" }}>
                  <Text variant="headingSm" as="h3">
                    Enable AI Assistant
                  </Text>
                  <Text variant="bodyMd" tone="subdued">
                    Turn AI Assistant on or off for your store.
                  </Text>
                </div>
              </SettingToggle>
              <input
                type="hidden"
                name="enabled"
                value={enabled.toString()}
              />
              {actionData?.success && (
                <div style={{ marginTop: "1rem" }}>
                  <Text tone="success">✓ Settings updated successfully.</Text>
                </div>
              )}
              {actionData?.error && (
                <div style={{ marginTop: "1rem" }}>
                  <Text tone="critical">✗ {actionData.error}</Text>
                </div>
              )}
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
