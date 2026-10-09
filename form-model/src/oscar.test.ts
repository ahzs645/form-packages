import { describe, expect, it } from 'vitest';
import { normalizeOscarExportSettings, readOscarExportSettings } from './oscar';
import { BuilderDocumentSchema, OscarExportSettingsSchema } from './schemas';

describe('OSCAR target settings', () => {
  it('keeps absent and future settings absent while the reader supplies a portable default', () => {
    expect(normalizeOscarExportSettings(undefined)).toBeUndefined();
    expect(normalizeOscarExportSettings(null)).toBeUndefined();
    expect(normalizeOscarExportSettings({ version: 2, profileId: 'juno' })).toBeUndefined();
    expect(readOscarExportSettings(undefined)).toEqual({ version: 1, profileId: 'portable', measurementMappings: [] });
  });
  it('retains incomplete and duplicate mappings for review and ignores verification claims', () => {
    const settings = normalizeOscarExportSettings({ profileId: 'juno', runtimeVerified: true,
      measurementMappings: [{ fieldId: ' weight ', measurementType: 'WT', measuringInstruction: '' }, { fieldId: 'weight', measurementType: 'WT', measuringInstruction: 'in kg' }] });
    expect(settings?.measurementMappings).toHaveLength(2);
    expect(settings?.measurementMappings[0].fieldId).toBe('weight');
    expect(settings).not.toHaveProperty('runtimeVerified');
    expect(OscarExportSettingsSchema.parse(settings)).toEqual(settings);
  });
  it('keeps the override in the canonical document schema and strips unsupported settings', () => {
    const settings = { version: 1 as const, profileId: 'juno' as const, measurementMappings: [] };
    const document = { name: 'Test', fields: [], design: {}, identityType: 'TESTFORM', identityCode: 'TEST',
      drafts: [], branchingRules: {}, paginationEnabled: false, pageCount: 1, pageAssignments: {},
      oscarExport: { ...settings, runtimeVerified: true } };
    expect(BuilderDocumentSchema.parse(document).oscarExport).toEqual(settings);
    expect(normalizeOscarExportSettings({ profileId: 'unknown', measurementMappings: [] })?.profileId).toBe('portable');
  });
});
