/** Supported field types for FE form rendering. */
export type FieldType = 'select' | 'text' | 'toggle' | 'number' | 'secret';

/** One option in a select field. */
export interface SelectOption {
  label: string;
  value: string | number | boolean | null;
}

/**
 * Rendering metadata for a single configuration field.
 * The key in `ConfigNamespaceMeta.fields` is the sub-path relative to the
 * namespace (e.g. `"general.enabled"` maps to `order.general.enabled`).
 */
export interface ConfigFieldMeta {
  /** Group label shown in the FE settings panel (e.g. "General"). */
  groupLabel: string;
  /** Human-readable field label (e.g. "Enabled"). */
  keyLabel: string;
  /** How the FE should render this field. */
  fieldType: FieldType;
  /** Required when fieldType === 'select'. */
  options?: SelectOption[];
  /**
   * Optional labeled options for a toggle field — exactly two entries:
   * index 0 is the "on" state, index 1 is the "off" state.
   * When omitted the FE should render the toggle with default "On / Off" labels.
   *
   * @example
   * toggleOptions: [{ label: 'Enable', value: 1 }, { label: 'Disable', value: 0 }]
   */
  toggleOptions?: [SelectOption, SelectOption];
}

/**
 * Top-level rendering metadata for a registered config namespace.
 *
 * @example
 * {
 *   moduleLabel: 'Order',
 *   fields: {
 *     'general.enabled': {
 *       groupLabel: 'General',
 *       keyLabel: 'Enabled',
 *       fieldType: 'select',
 *       options: [{ label: 'Yes', value: true }, { label: 'No', value: false }],
 *     },
 *   },
 * }
 */
export interface ConfigNamespaceMeta {
  /** Human-readable module label shown in FE navigation (e.g. "Order"). */
  moduleLabel: string;
  /**
   * Field metadata keyed by namespace-relative dot-path.
   * e.g. `"general.enabled"` corresponds to the full path `order.general.enabled`.
   */
  fields: Record<string, ConfigFieldMeta>;
}
