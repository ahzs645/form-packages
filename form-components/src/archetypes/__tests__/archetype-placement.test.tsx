// @vitest-environment happy-dom
/**
 * Cross-archetype MOIS placement parity.
 *
 * Every archetype's `.All` member must respect a Grid `placement` selection:
 * only the placed fields render (as a strict subset of the full field set),
 * and without a placement the full set renders. This is the contract the
 * real engine implements via section-context fieldPlacement — see
 * controls/Grid.tsx and components/Layout.tsx (LayoutItem + ArchAll).
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFormStateProvider } from '../../hooks/form-state';
import { Grid } from '../../controls/Grid';
import { Mois } from '../index';

const ARCHETYPE_NAMES = [
  'AssociatedParty',
  'ChartPreference',
  'Connection',
  'Correspondence',
  'Encounter',
  'Observation',
  'ObservationPanel',
  'Patient',
  'Task',
] as const;

describe('archetype All respects Grid placement', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderGrid(All: React.FC<any>, placement?: string): Promise<string[]> {
    await act(async () => {
      root.render(
        <LocalFormStateProvider>
          <Grid columnTemplate="1fr 1fr" placement={placement}>
            {All}
          </Grid>
        </LocalFormStateProvider>
      );
    });
    return Array.from(container.querySelectorAll('label')).map((el) => el.textContent ?? '');
  }

  for (const name of ARCHETYPE_NAMES) {
    it(`${name}.All renders only the placed fields`, async () => {
      const archetype = (Mois as Record<string, any>)[name];
      expect(archetype?.All, `${name}.All must exist`).toBeTypeOf('function');
      expect(archetype?.Fields, `${name}.Fields must exist`).toBeTypeOf('object');

      const keys = Object.keys(archetype.Fields);
      expect(keys.length).toBeGreaterThan(2);

      const allLabels = await renderGrid(archetype.All);
      await act(async () => root.unmount());
      root = createRoot(container);

      const placedLabels = await renderGrid(archetype.All, `${keys[0]} ${keys[1]}`);

      // Strict subset: the placed render must be materially smaller...
      expect(
        placedLabels.length,
        `placed render must hide unplaced fields (all=${allLabels.length}, placed=${placedLabels.length})`
      ).toBeLessThan(allLabels.length);
      // ...bounded by the two placed fields (a field may render a couple of
      // nested labels, so allow slack without letting a full dump pass)...
      expect(placedLabels.length).toBeLessThanOrEqual(6);
      // ...and contain nothing that the full render doesn't.
      for (const label of placedLabels) {
        expect(allLabels).toContain(label);
      }
    });
  }
});
