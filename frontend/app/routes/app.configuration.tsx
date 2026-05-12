import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Select as PolarisSelect,
  TextField,
  Collapsible,
  Divider,
  Spinner,
  SkeletonBodyText,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { assistantTheme as theme } from "~/styles/assistant-theme";

// ── Types (mirror of backend config-meta.types.ts) ──────────────────────────
type FieldType = "select" | "text" | "toggle" | "number" | "secret";

interface SelectOption {
  label: string;
  value: string | number | boolean | null;
}

interface ConfigFieldMeta {
  groupLabel: string;
  keyLabel: string;
  fieldType: FieldType;
  options?: SelectOption[];
  /** Exactly [onOption, offOption] for toggle fields. */
  toggleOptions?: [SelectOption, SelectOption];
}

interface ConfigNamespaceMeta {
  moduleLabel: string;
  fields: Record<string, ConfigFieldMeta>;
}

type Schema = Record<string, ConfigNamespaceMeta>;
type ConfigValues = Record<string, Record<string, unknown>>;

// ── Server ───────────────────────────────────────────────────────────────────
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json({ shopId: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const { sessionToken, shopId, intent, changes } = await request.json();

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };

  if (intent === "load") {
    const [schemaRes, valuesRes] = await Promise.all([
      fetch(`${process.env.BACKEND_URL}/config/schema`, { headers: authHeaders }),
      fetch(`${process.env.BACKEND_URL}/config/${shopId}`, { headers: authHeaders }),
    ]);
    return json({
      schema: (await schemaRes.json()) as Schema,
      values: (await valuesRes.json()) as ConfigValues,
    });
  }

  // Bulk save: one backend call per changed field, run in parallel
  const results = await Promise.all(
    (changes as Array<{ path: string; value: unknown }>).map((change) =>
      fetch(`${process.env.BACKEND_URL}/config/${shopId}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(change),
      })
    )
  );
  const allOk = results.every((r) => r.ok);
  return json({ saved: allOk }, { status: allOk ? 200 : 500 });
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setNestedValue(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown
): Record<string, unknown> {
  const parts = dotPath.split(".");
  const result = { ...obj };
  let cursor = result as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor[parts[i]] = { ...(cursor[parts[i]] as Record<string, unknown> ?? {}) };
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
}

/** Groups field entries by their groupLabel, preserving insertion order. */
function groupFields(fields: Record<string, ConfigFieldMeta>) {
  const map = new Map<string, Array<[string, ConfigFieldMeta]>>();
  for (const entry of Object.entries(fields)) {
    const label = entry[1].groupLabel;
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(entry);
  }
  return Array.from(map.entries()).map(([groupLabel, entries]) => ({
    groupLabel,
    entries,
  }));
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 12,
        background: checked ? theme.colors.brand : theme.colors.disabled,
        border: `1px solid ${checked ? theme.colors.brand : theme.colors.border}`,
        position: "relative",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: `background ${theme.transitions.fast}, border-color ${theme.transitions.fast}`,
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: "50%",
          left: checked ? 23 : 3,
          transform: "translateY(-50%)",
          transition: "left 0.2s",
          boxShadow: theme.shadows.bubble,
        }}
      />
    </button>
  );
}

// ── Field renderer ────────────────────────────────────────────────────────────
function ConfigField({
  namespace,
  fieldPath,
  fieldMeta,
  value,
  onChange,
}: {
  namespace: string;
  fieldPath: string;
  fieldMeta: ConfigFieldMeta;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${namespace}-${fieldPath.replace(/\./g, "-")}`;

  const renderControl = () => {
    switch (fieldMeta.fieldType) {
      case "select":
        return (
          <PolarisSelect
            label=""
            labelHidden
            id={id}
            options={(fieldMeta.options ?? []).map((o) => ({
              label: o.label,
              value: String(o.value),
            }))}
            value={String(value ?? "")}
            onChange={(v) => {
              const opt = fieldMeta.options?.find((o) => String(o.value) === v);
              onChange(opt !== undefined ? opt.value : v);
            }}
          />
        );

      case "toggle": {
        const isOn = Boolean(value);
        const stateLabel = fieldMeta.toggleOptions
          ? (isOn ? fieldMeta.toggleOptions[0].label : fieldMeta.toggleOptions[1].label)
          : (isOn ? "On" : "Off");
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: theme.spacing.md,
            }}
          >
            <ToggleSwitch
              checked={isOn}
              onChange={(newChecked) => {
                if (fieldMeta.toggleOptions) {
                  // Use the typed option values (e.g. 1/0) rather than plain boolean
                  onChange(
                    newChecked
                      ? fieldMeta.toggleOptions[0].value
                      : fieldMeta.toggleOptions[1].value
                  );
                } else {
                  onChange(newChecked);
                }
              }}
            />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                color: theme.colors.textSecondary,
                fontSize: theme.typography.body,
                lineHeight: "24px",
                fontFamily: "inherit",
              }}
            >
              {stateLabel}
            </span>
          </div>
        );
      }

      case "number":
        return (
          <TextField
            label=""
            labelHidden
            id={id}
            type="number"
            value={String(value ?? "")}
            onChange={(v) => onChange(v === "" ? "" : Number(v))}
            autoComplete="off"
          />
        );

      case "secret":
        return (
          <TextField
            label=""
            labelHidden
            id={id}
            type="password"
            value={String(value ?? "")}
            onChange={(v) => onChange(v)}
            autoComplete="new-password"
          />
        );

      default: // "text"
        return (
          <TextField
            label=""
            labelHidden
            id={id}
            type="text"
            value={String(value ?? "")}
            onChange={(v) => onChange(v)}
            autoComplete="off"
          />
        );
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: `${theme.spacing.sm} ${theme.spacing.lg}`,
        alignItems: "center",
        padding: `${theme.spacing.md} 0`,
      }}
    >
      <label htmlFor={id}>
        <Text variant="bodyMd" as="span" fontWeight="medium">
          {fieldMeta.keyLabel}
        </Text>
      </label>
      <div>{renderControl()}</div>
    </div>
  );
}

// ── Collapsible group (Magento-style) ─────────────────────────────────────────
function ConfigGroup({
  groupLabel,
  namespace,
  entries,
  nsValues,
  onFieldChange,
}: {
  groupLabel: string;
  namespace: string;
  entries: Array<[string, ConfigFieldMeta]>;
  nsValues: Record<string, unknown>;
  onFieldChange: (fieldPath: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = `grp-${namespace}-${groupLabel.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div>
      {/* Group header */}
      <button
        type="button"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `${theme.spacing.md} ${theme.spacing.lg}`,
          background: theme.colors.pageBackground,
          border: `1px solid ${theme.colors.borderSubtle}`,
          borderRadius: open ? "6px 6px 0 0" : "6px",
          cursor: "pointer",
          textAlign: "left",
          transition: "border-radius 0.15s",
        }}
      >
        <Text variant="headingSm" as="span">
          {groupLabel}
        </Text>
        <span
          aria-hidden
          style={{
            display: "inline-block",
            color: theme.colors.textSecondary,
            fontSize: "0.65rem",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
            lineHeight: 1,
          }}
        >
          ▼
        </span>
      </button>

      {/* Collapsible body */}
      <Collapsible open={open} id={id}>
        <div
          style={{
            border: `1px solid ${theme.colors.borderSubtle}`,
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            padding: `0 ${theme.spacing.lg}`,
            background: theme.colors.surface,
          }}
        >
          {entries.map(([fieldPath, fieldMeta], i) => (
            <div
              key={fieldPath}
              style={
                i < entries.length - 1
                  ? { borderBottom: `1px solid ${theme.colors.borderSubtle}` }
                  : undefined
              }
            >
              <ConfigField
                namespace={namespace}
                fieldPath={fieldPath}
                fieldMeta={fieldMeta}
                value={getNestedValue(nsValues, fieldPath)}
                onChange={(v) => onFieldChange(fieldPath, v)}
              />
            </div>
          ))}
        </div>
      </Collapsible>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Configuration() {
  const { shopId } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  const loadFetcher = useFetcher<{ schema: Schema; values: ConfigValues }>();
  const saveFetcher = useFetcher<{ saved: boolean }>();

  const [localValues, setLocalValues] = useState<ConfigValues>({});
  const [savedBanner, setSavedBanner] = useState(false);
  const schema: Schema = loadFetcher.data?.schema ?? {};

  useEffect(() => {
    (async () => {
      const sessionToken = await shopify.idToken();
      loadFetcher.submit(
        JSON.stringify({ intent: "load", sessionToken, shopId }),
        { method: "POST", encType: "application/json" }
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  useEffect(() => {
    if (loadFetcher.data?.values) {
      setLocalValues(loadFetcher.data.values);
    }
  }, [loadFetcher.data?.values]);

  useEffect(() => {
    if (saveFetcher.data?.saved) {
      setSavedBanner(true);
      const t = setTimeout(() => setSavedBanner(false), 3000);
      return () => clearTimeout(t);
    }
  }, [saveFetcher.data]);

  const handleChange = (namespace: string, fieldPath: string, value: unknown) => {
    setLocalValues((prev) => ({
      ...prev,
      [namespace]: setNestedValue(
        (prev[namespace] as Record<string, unknown>) ?? {},
        fieldPath,
        value
      ),
    }));
  };

  const handleSave = async () => {
    const sessionToken = await shopify.idToken();
    const changes: Array<{ path: string; value: unknown }> = [];

    for (const [namespace, nsMeta] of Object.entries(schema)) {
      for (const [fieldPath, fieldMeta] of Object.entries(nsMeta.fields)) {
        const value = getNestedValue(
          (localValues[namespace] as Record<string, unknown>) ?? {},
          fieldPath
        );
        // Skip secret fields that haven't been modified (still showing the mask)
        if (fieldMeta.fieldType === "secret" && value === "****") continue;
        changes.push({ path: `${namespace}.${fieldPath}`, value });
      }
    }

    saveFetcher.submit(
      JSON.stringify({ sessionToken, shopId, changes }),
      { method: "POST", encType: "application/json" }
    );
  };

  const isLoading = loadFetcher.state !== "idle";
  const isSaving = saveFetcher.state !== "idle";

  return (
    <div style={{ fontFamily: theme.typography.fontFamily, margin: `0 ${theme.spacing.lg}` }}>
      <Page>
        <Layout>
        <Layout.Section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: theme.spacing.md,
              flexWrap: "wrap",
            }}
          >
            <Text variant="headingLg" as="h1">
              Configuration
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.sm }}>
              {isSaving && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: theme.spacing.xs,
                    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                    borderRadius: theme.radius.button,
                    border: `1px solid ${theme.colors.borderSubtle}`,
                    background: theme.colors.surface,
                  }}
                >
                  <Spinner size="small" />
                  <span
                    style={{
                      color: theme.colors.textSecondary,
                      fontSize: theme.typography.small,
                      lineHeight: "16px",
                    }}
                  >
                    Saving changes...
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                style={{
                  background: theme.colors.brand,
                  color: theme.colors.white,
                  border: `1px solid ${theme.colors.brand}`,
                  borderRadius: theme.radius.button,
                  padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                  fontFamily: "inherit",
                  fontSize: theme.typography.body,
                  fontWeight: 700,
                  cursor: isSaving || isLoading ? "not-allowed" : "pointer",
                  opacity: isSaving || isLoading ? 0.7 : 1,
                  boxShadow: isSaving ? "none" : theme.shadows.bubble,
                  transition: `opacity ${theme.transitions.fast}`,
                }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </Layout.Section>

        {savedBanner && (
          <Layout.Section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: theme.spacing.sm,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                border: `1px solid ${theme.colors.borderSubtle}`,
                borderLeft: `4px solid ${theme.colors.brand}`,
                borderRadius: theme.radius.button,
                background: theme.colors.surface,
              }}
            >
              <span
                style={{
                  color: theme.colors.textSecondary,
                  fontSize: theme.typography.body,
                  lineHeight: "20px",
                }}
              >
                Configuration saved successfully.
              </span>
              <button
                type="button"
                onClick={() => setSavedBanner(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.colors.textSecondary,
                  cursor: "pointer",
                  fontSize: theme.typography.body,
                  lineHeight: "20px",
                  padding: 0,
                }}
                aria-label="Dismiss saved message"
              >
                Dismiss
              </button>
            </div>
          </Layout.Section>
        )}

        {isLoading && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: theme.spacing.sm,
                  }}
                >
                  <Spinner size="small" />
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Loading configuration...
                  </Text>
                </div>
                <SkeletonBodyText lines={6} />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {!isLoading &&
          Object.entries(schema).map(([namespace, nsMeta]) => {
            const groups = groupFields(nsMeta.fields);
            const nsValues =
              (localValues[namespace] as Record<string, unknown>) ?? {};

            return (
              <Layout.Section key={namespace}>
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h3">
                      {nsMeta.moduleLabel}
                    </Text>
                    <BlockStack gap="200">
                      {groups.map(({ groupLabel, entries }) => (
                        <ConfigGroup
                          key={groupLabel}
                          groupLabel={groupLabel}
                          namespace={namespace}
                          entries={entries}
                          nsValues={nsValues}
                          onFieldChange={(fieldPath, value) =>
                            handleChange(namespace, fieldPath, value)
                          }
                        />
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>
      </Page>
    </div>
  );
}
