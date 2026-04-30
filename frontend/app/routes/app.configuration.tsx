import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";

// Mirror of backend config-meta.types.ts
type FieldType = "select" | "text" | "toggle" | "number";

interface SelectOption {
  label: string;
  value: string | number | boolean | null;
}

interface ConfigFieldMeta {
  groupLabel: string;
  keyLabel: string;
  fieldType: FieldType;
  options?: SelectOption[];
}

interface ConfigNamespaceMeta {
  moduleLabel: string;
  fields: Record<string, ConfigFieldMeta>;
}

type Schema = Record<string, ConfigNamespaceMeta>;
type ConfigValues = Record<string, Record<string, unknown>>;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return json({ shopId: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const { sessionToken, shopId, intent, path, value } = await request.json();

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

  const res = await fetch(`${process.env.BACKEND_URL}/config/${shopId}`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ path, value }),
  });
  return json(await res.json(), { status: res.status });
};

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

export default function Configuration() {
  const { shopId } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  const loadFetcher = useFetcher<{ schema: Schema; values: ConfigValues }>();
  const saveFetcher = useFetcher<{ saved: boolean }>();

  const [localValues, setLocalValues] = useState<ConfigValues>({});
  const schema = loadFetcher.data?.schema ?? {};

  useEffect(() => {
    (async () => {
      const sessionToken = await shopify.idToken();
      loadFetcher.submit(
        { intent: "load", sessionToken, shopId },
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
    for (const [namespace, nsMeta] of Object.entries(schema)) {
      for (const fieldPath of Object.keys(nsMeta.fields)) {
        const value = getNestedValue(
          (localValues[namespace] as Record<string, unknown>) ?? {},
          fieldPath
        );
        saveFetcher.submit(
          { sessionToken, shopId, path: `${namespace}.${fieldPath}`, value },
          { method: "POST", encType: "application/json" }
        );
      }
    }
  };

  const isLoading = loadFetcher.state !== "idle";
  const isSaving = saveFetcher.state !== "idle";

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 760 }}>
      <h1>Configuration</h1>

      {isLoading && <p style={{ color: "#666" }}>Loading configuration…</p>}

      {!isLoading &&
        Object.entries(schema).map(([namespace, nsMeta]) => (
          <section
            key={namespace}
            style={{
              marginBottom: "2rem",
              border: "1px solid #e1e3e5",
              borderRadius: 8,
              padding: "1.25rem",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{nsMeta.moduleLabel}</h2>

            {Object.entries(nsMeta.fields).map(([fieldPath, fieldMeta]) => {
              const currentValue = getNestedValue(
                (localValues[namespace] as Record<string, unknown>) ?? {},
                fieldPath
              );

              return (
                <div
                  key={fieldPath}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.5rem 1rem",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <label>
                    <span style={{ fontWeight: 600 }}>{fieldMeta.keyLabel}</span>
                    {fieldMeta.groupLabel && (
                      <span style={{ color: "#6d7175", fontSize: "0.85em", marginLeft: 6 }}>
                        ({fieldMeta.groupLabel})
                      </span>
                    )}
                  </label>

                  {fieldMeta.fieldType === "select" && fieldMeta.options ? (
                    <select
                      value={String(currentValue ?? "")}
                      onChange={(e) => {
                        const opt = fieldMeta.options!.find(
                          (o) => String(o.value) === e.target.value
                        );
                        handleChange(namespace, fieldPath, opt?.value ?? e.target.value);
                      }}
                      style={{ padding: "0.35rem 0.5rem", borderRadius: 4 }}
                    >
                      {fieldMeta.options.map((opt) => (
                        <option key={String(opt.value)} value={String(opt.value)}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : fieldMeta.fieldType === "toggle" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(currentValue)}
                      onChange={(e) => handleChange(namespace, fieldPath, e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                  ) : fieldMeta.fieldType === "number" ? (
                    <input
                      type="number"
                      value={String(currentValue ?? "")}
                      onChange={(e) =>
                        handleChange(namespace, fieldPath, Number(e.target.value))
                      }
                      style={{ padding: "0.35rem 0.5rem", borderRadius: 4 }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(currentValue ?? "")}
                      onChange={(e) => handleChange(namespace, fieldPath, e.target.value)}
                      style={{ padding: "0.35rem 0.5rem", borderRadius: 4 }}
                    />
                  )}
                </div>
              );
            })}
          </section>
        ))}

      <button
        onClick={handleSave}
        disabled={isSaving || isLoading}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: 6,
          background: "#008060",
          color: "#fff",
          border: "none",
          cursor: isSaving || isLoading ? "not-allowed" : "pointer",
          opacity: isSaving || isLoading ? 0.6 : 1,
        }}
      >
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
