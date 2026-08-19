/**
 * Shared section-aware data binding for archetype field components.
 *
 * MOIS parity: archetype fields read and write through the enclosing
 * section's activeSelector (a SubForm editing fd.someEditArea, a list row,
 * ...) against the form-state store — the same store and write path the
 * standard controls use. When no custom activeSelector is in play (standalone
 * gallery previews), fields fall back to the archetype's example demo data in
 * the MoisContext store so demos stay populated and interactive.
 */

import React from 'react';
import { useActiveData, useSection, SectionContextValue } from '../context/MoisContext';
import { useActiveDataSlice } from '../hooks/form-state';
import { getSectionActiveTarget, writeSectionActiveFieldValue } from '../runtime/mois-contract';

export interface ArchetypeBinding {
  /** The record the field should display (section target or example data). */
  data: Record<string, any> | undefined;
  /** Write one field value to wherever this binding reads from. */
  setField: (fieldId: string, value: unknown) => void;
  /** True when bound to a custom section target instead of example data. */
  hasCustomTarget: boolean;
}

export interface ArchetypeBindingOptions {
  /** Read the archetype's demo record from the MoisContext example data. */
  exampleData: (activeData: any) => Record<string, any> | undefined;
  /**
   * Return the mutable demo record on the MoisContext draft (creating it if
   * needed) for gallery writes. Receives the immer draft of the whole store.
   */
  exampleTarget: (draft: any) => Record<string, any>;
  /** Optional section overrides forwarded from the field's props. */
  section?: Partial<SectionContextValue>;
}

export const useArchetypeBinding = ({
  exampleData,
  exampleTarget,
  section: sectionOverride,
}: ArchetypeBindingOptions): ArchetypeBinding => {
  const section = useSection(sectionOverride);

  // Form-state store (what the compiled form's useActiveData writes into).
  const [slice, setFormData] = useActiveDataSlice((data: any) => ({
    target: getSectionActiveTarget(data, section),
    defaultTarget: data?.field?.data ?? data,
  }));
  const hasCustomTarget = slice.target != null && slice.target !== slice.defaultTarget;

  // MoisContext demo store (gallery example data).
  const [moisActiveData, setMoisActiveData] = useActiveData();
  const demoRecord = exampleData(moisActiveData);

  const setField = React.useCallback((fieldId: string, value: unknown) => {
    if (hasCustomTarget) {
      setFormData((draft: any) => {
        writeSectionActiveFieldValue(draft, section, fieldId, value);
      });
      return;
    }
    setMoisActiveData((draft: any) => {
      exampleTarget(draft)[fieldId] = value;
    });
    // exampleTarget is intentionally uncaptured: callers pass inline lambdas,
    // and the write path only runs on user interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCustomTarget, section, setFormData, setMoisActiveData]);

  return {
    data: hasCustomTarget ? (slice.target as Record<string, any>) : demoRecord,
    setField,
    hasCustomTarget,
  };
};

/** MOIS stores coded values as { code, display, system }; demos may hold bare codes. */
export const codeOf = (value: any): string =>
  (value && typeof value === 'object' ? value.code : value) ?? '';

export const toCodedValue = (
  option: { key?: string | number; text?: string } | undefined,
  system: string
): { code: string; display: string; system: string } | null =>
  option && option.key !== '' && option.key !== undefined
    ? { code: String(option.key), display: option.text ?? String(option.key), system }
    : null;
