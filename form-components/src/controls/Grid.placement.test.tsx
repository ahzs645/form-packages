// @vitest-environment happy-dom
/**
 * MOIS placement-contract parity (verified against the SMOIS FormTester
 * bundle): a Grid's `placement` travels through section context, every field
 * wrapper hides itself when a placement exists without its layoutId, and the
 * archetype `.All` members render only the placed fields as direct grid
 * children. Repro form: test_chart_preference-0.2.0 ("ALL Immunizations Not
 * Desired" must show only Reason + Start/End date).
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFormStateProvider, useActiveDataForForms } from '../hooks/form-state';
import { Grid } from './Grid';
import { ChartPreference } from '../archetypes/ChartPreference';

/**
 * Seeds fd.preferenceEdit the way the repro form's useOnLoad + edit handler
 * do — through the form-state store the compiled form's useActiveData binds to.
 */
const SeedPreferenceEdit: React.FC<{ template: Record<string, unknown>; children: React.ReactNode }> = ({
  template,
  children,
}) => {
  const [, setFd] = useActiveDataForForms();
  const [seeded, setSeeded] = React.useState(false);
  React.useEffect(() => {
    setFd((draft: any) => {
      draft.preferenceEdit = { ...template };
    });
    setSeeded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return seeded ? <>{children}</> : null;
};

const ALL_FIELD_LABELS = [
  'Attached', 'Subject code', 'Classification', 'Encounter Id', 'End date',
  'Show on demo.', 'Instruction', 'Instruction detail', 'Patient Id',
  'Preference', 'Preference type', 'Reason', 'Reason detail', 'Sensitive',
  'Start date', 'Code type', 'Concept', 'Subject detail',
];

describe('Grid placement contract (MOIS parity)', () => {
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

  async function render(node: React.ReactNode) {
    await act(async () => {
      root.render(<LocalFormStateProvider>{node}</LocalFormStateProvider>);
    });
  }

  function renderedLabels(): string[] {
    return Array.from(container.querySelectorAll('label')).map((el) => el.textContent ?? '');
  }

  it('renders only the placed archetype fields (curated modal case)', async () => {
    // The "ALL Immunizations Not Desired" button's dialog from the repro form.
    await render(
      <Grid
        columnTemplate="1fr 1fr"
        placement={`reason reason
                    startDate endDate`}
      >
        {ChartPreference.All}
      </Grid>
    );

    const labels = renderedLabels();
    expect(labels).toContain('Reason');
    expect(labels).toContain('Start date');
    expect(labels).toContain('End date');
    for (const hidden of ALL_FIELD_LABELS.filter((l) => !['Reason', 'Start date', 'End date'].includes(l))) {
      expect(labels, `field "${hidden}" must be hidden by placement`).not.toContain(hidden);
    }
  });

  it('renders placed fields in placement order as direct grid children with gridArea', async () => {
    await render(
      <Grid
        columnTemplate="1fr 1fr"
        placement={`reason reason
                    startDate endDate`}
      >
        {ChartPreference.All}
      </Grid>
    );

    expect(renderedLabels()).toEqual(['Reason', 'Start date', 'End date']);

    const gridDiv = Array.from(container.querySelectorAll('div'))
      .find((el) => el.style.display === 'grid') as HTMLDivElement;
    expect(gridDiv).toBeTruthy();

    // Fields are direct children of the grid container (Fragment, no wrapper
    // div) so their gridArea actually positions them.
    const children = Array.from(gridDiv.children) as HTMLElement[];
    expect(children).toHaveLength(3);
    // parsePlacement: reason spans row 1 cols 1-2; the dates sit on row 2.
    expect(children[0].style.gridArea).toBe('1 / 1 / 2 / 3');
    expect(children[1].style.gridArea).toBe('2 / 1 / 3 / 2');
    expect(children[2].style.gridArea).toBe('2 / 2 / 3 / 3');
  });

  it('shows the default PreferenceEdit field set for the wider dialogs', async () => {
    // Default placement from the repro form's PreferenceEdit component
    // (matches the MOST / CPR / ROTAVIRUS dialogs in real MOIS).
    await render(
      <Grid
        columnTemplate="1fr 1fr"
        placement={`subjectDetail subjectDetail
                    instruction instruction
                    instructionDetail instructionDetail
                    reason reason
                    reasonDetail reasonDetail
                    startDate endDate
                    sensitive includeOnDemographics`}
      >
        {ChartPreference.All}
      </Grid>
    );

    expect(renderedLabels()).toEqual([
      'Subject detail',
      'Instruction',
      'Instruction detail',
      'Reason',
      'Reason detail',
      'Start date',
      'End date',
      'Sensitive',
      'Show on demo.',
    ]);
  });

  it('renders every archetype field when the grid has no placement', async () => {
    await render(
      <Grid columnTemplate="1fr 1fr">
        {ChartPreference.All}
      </Grid>
    );

    const labels = renderedLabels();
    for (const label of ALL_FIELD_LABELS) {
      expect(labels, `field "${label}" must render without placement`).toContain(label);
    }
  });

  it('keeps direct children without a layoutId visible inside a placed grid', async () => {
    await render(
      <Grid columnTemplate="1fr 1fr" placement={`reason reason`}>
        <div data-testid="free-content">not a field</div>
        <ChartPreference.All />
      </Grid>
    );

    expect(container.querySelector('[data-testid="free-content"]')).toBeTruthy();
    expect(renderedLabels()).toEqual(['Reason']);
  });

  it('binds placed fields to the section active target (SubForm preferenceEdit case)', async () => {
    // The repro form opens its dialogs with
    // section={{ activeSelector: (fd) => fd.preferenceEdit }} and a template
    // seeded into fd.preferenceEdit. Fields must show the template values,
    // not gallery example data.
    await render(
      <SeedPreferenceEdit
        template={{
          preference: 'ALL IMMUNIZATIONS CLIENT/GUARDIAN',
          startDate: '2026-08-19',
        }}
      >
        <Grid
          columnTemplate="1fr 1fr"
          placement={`preference preference
                      startDate endDate`}
          section={{ activeSelector: (fd: any) => fd.preferenceEdit }}
        >
          {ChartPreference.All}
        </Grid>
      </SeedPreferenceEdit>
    );
    // setFormData updates flush on a microtask; give them a commit.
    await act(async () => {});

    const inputs = Array.from(container.querySelectorAll('input')) as HTMLInputElement[];
    const values = inputs.map((el) => el.value);
    expect(values).toContain('ALL IMMUNIZATIONS CLIENT/GUARDIAN');
    // Gallery example data (e.g. TETANUS VACCINE) must not leak into the dialog.
    expect(values).not.toContain('TETANUS VACCINE');
  });
});
