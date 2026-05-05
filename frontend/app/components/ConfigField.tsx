import { useState } from 'react';
import { TextField, Checkbox, Select, InlineStack, Text } from '@shopify/polaris';

export interface ConfigFieldProps {
  fieldType: 'toggle' | 'text' | 'number' | 'encrypted' | 'select';
  path: string;
  label: string;
  value: unknown;
  options?: Array<{ label: string; value: string | number | boolean | null }>;
  onChange: (path: string, value: unknown) => void;
}

export function ConfigField({ fieldType, path, label, value, options, onChange }: ConfigFieldProps) {
  const [revealed, setRevealed] = useState(false);

  switch (fieldType) {
    case 'toggle': {
      return (
        <Checkbox
          label={label}
          checked={!!value}
          onChange={(checked) => onChange(path, checked)}
        />
      );
    }

    case 'text': {
      return (
        <TextField
          label={label}
          value={String(value ?? '')}
          onChange={(v) => onChange(path, v)}
          autoComplete="off"
        />
      );
    }

    case 'number': {
      return (
        <TextField
          label={label}
          type="number"
          value={String(value ?? '')}
          onChange={(v) => onChange(path, v === '' ? '' : Number(v))}
          autoComplete="off"
        />
      );
    }

    case 'encrypted': {
      const isMasked = value === '****';
      const displayValue = isMasked ? '' : String(value ?? '');
      return (
        <TextField
          label={label}
          type={revealed ? 'text' : 'password'}
          value={displayValue}
          placeholder={isMasked ? '••••••••  (unchanged)' : ''}
          onChange={(v) => onChange(path, v)}
          autoComplete="off"
          suffix={
            <InlineStack gap="100" blockAlign="center">
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                onClick={() => setRevealed((r) => !r)}
                aria-label={revealed ? 'Hide value' : 'Reveal value'}
              >
                <Text as="span" variant="bodySm">
                  {revealed ? 'Hide' : 'Reveal'}
                </Text>
              </button>
            </InlineStack>
          }
          helpText="Stored encrypted at rest. Leave blank to keep existing value."
        />
      );
    }

    case 'select': {
      const selectOptions = (options ?? []).map((o) => ({
        label: o.label,
        value: String(o.value),
      }));
      return (
        <Select
          label={label}
          options={selectOptions}
          value={String(value ?? '')}
          onChange={(v) => onChange(path, v)}
        />
      );
    }

    default:
      return null;
  }
}
