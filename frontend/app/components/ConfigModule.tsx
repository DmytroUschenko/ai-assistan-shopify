import { Card, BlockStack, Text, Divider } from '@shopify/polaris';
import { ConfigField } from './ConfigField';

export interface ConfigFieldMeta {
  groupLabel: string;
  keyLabel: string;
  fieldType: 'toggle' | 'text' | 'number' | 'encrypted' | 'select';
  options?: Array<{ label: string; value: string | number | boolean | null }>;
}

export interface ConfigNamespaceMeta {
  moduleLabel: string;
  fields: Record<string, ConfigFieldMeta>;
}

interface Props {
  namespace: string;
  meta: ConfigNamespaceMeta;
  /** Flat or nested values object for this namespace */
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
}

function getNestedValue(obj: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function ConfigModule({ namespace, meta, values, onChange }: Props) {
  // Group fields by groupLabel
  const groups = new Map<string, Array<[string, ConfigFieldMeta]>>();
  for (const [subPath, fieldMeta] of Object.entries(meta.fields)) {
    const group = fieldMeta.groupLabel;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push([subPath, fieldMeta]);
  }

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          {meta.moduleLabel}
        </Text>

        {Array.from(groups.entries()).map(([groupLabel, fields], groupIndex) => (
          <BlockStack key={groupLabel} gap="300">
            {groupIndex > 0 && <Divider />}
            <Text variant="headingSm" as="h3" tone="subdued">
              {groupLabel}
            </Text>
            {fields.map(([subPath, fieldMeta]) => {
              const fullPath = `${namespace}.${subPath}`;
              const value = getNestedValue(values, subPath);
              return (
                <ConfigField
                  key={subPath}
                  fieldType={fieldMeta.fieldType}
                  path={fullPath}
                  label={fieldMeta.keyLabel}
                  value={value}
                  options={fieldMeta.options}
                  onChange={onChange}
                />
              );
            })}
          </BlockStack>
        ))}
      </BlockStack>
    </Card>
  );
}
