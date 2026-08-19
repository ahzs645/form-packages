// @vitest-environment happy-dom
/**
 * End-to-end MOIS parity for placement-driven modals, through the real
 * compile pipeline (Babel + createComponentFromCode + buildScope) — the same
 * path MoisFormRenderer / JsxFormPreview use.
 *
 * Distilled from the vendor repro form test_chart_preference-0.2.0: a
 * PreferenceButton opens a SubForm dialog whose Grid places a curated subset
 * of Mois.ChartPreference.All. Real MOIS shows ONLY the placed fields
 * (Reason + Start/End date for "ALL Immunizations Not Desired").
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as Babel from '@babel/standalone';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createComponentFromCode, BaseScopeBuilder } from '@mois/form-engine-core';
import { buildScope } from './build-scope';
import { FormStateProvider, initFormData } from '../hooks/form-state';

const FORM_SOURCE = `
const FormComponent = () => {
  const [fd, setFd] = useActiveData()

  useOnLoad((sd, fd) => {
    fd.setFormData(
      produce((draft) => {
        draft.preferenceEdit = {}
      })
    )
  })

  return (
    <Form>
      <PreferenceButton
        buttonText="ALL Immunizations Not Desired"
        placement={\`reason reason
                    startDate endDate\`}
        template={{
          preference: "ALL IMMUNIZATIONS CLIENT/GUARDIAN",
          startDate: "2026-08-19",
        }}
      />
    </Form>
  )
}

const PreferenceButton = ({ buttonText, template, ...rest }) => {
  const [fd] = useActiveData()
  const [hide, setHide] = React.useState(true)

  return (
    <>
      <Fluent.DefaultButton
        text={buttonText}
        onClick={() => {
          fd.setFormData(
            produce((draft) => {
              draft.preferenceEdit = template
            })
          )
          setHide(false)
        }}
      />
      <PreferenceEdit {...{ buttonText, hide, setHide }} {...rest} />
    </>
  )
}

const PreferenceEdit = ({
  buttonText,
  hide,
  setHide,
  placement = \`subjectDetail subjectDetail
               instruction instruction
               reason reason
               startDate endDate\`,
}) => {
  return (
    <SubForm
      hidden={hide}
      onCancel={() => setHide(true)}
      minWidth={500}
      dialogContentProps={{ title: buttonText }}
      section={{ activeSelector: (fd) => fd.preferenceEdit }}
    >
      <Grid columnTemplate="1fr 1fr" placement={placement} size="100%">
        {Mois.ChartPreference.All}
      </Grid>
    </SubForm>
  )
}
`;

describe('preference modal parity (compiled form pipeline)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    initFormData();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    // Fluent Dialog portals into document.body layers; clear leftovers.
    document.body.innerHTML = '';
  });

  it('opens the dialog with only the placed ChartPreference fields', async () => {
    const scope = buildScope();
    const scopeBuilder = new BaseScopeBuilder();
    scopeBuilder.buildScope = () => scope;

    const Component = createComponentFromCode(FORM_SOURCE, {
      babel: Babel,
      scopeBuilder,
    });

    await act(async () => {
      root.render(
        <FormStateProvider>
          <Component />
        </FormStateProvider>
      );
    });

    const openButton = Array.from(document.querySelectorAll('button'))
      .find((el) => el.textContent?.includes('ALL Immunizations Not Desired'));
    expect(openButton, 'preference button must render').toBeTruthy();

    await act(async () => {
      openButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // setFormData updates flush on a microtask; give them a commit.
    await act(async () => {});

    const subForm = document.querySelector('[data-component="SubForm"]');
    expect(subForm, 'dialog must open').toBeTruthy();

    const labels = Array.from(subForm!.querySelectorAll('label')).map((el) => el.textContent ?? '');
    expect(labels).toEqual(['Reason', 'Start date', 'End date']);

    // Placed fields bind to the section target: the template's startDate
    // shows in DateSelect's MOIS display format (matching real MOIS).
    const inputs = Array.from(subForm!.querySelectorAll('input')) as HTMLInputElement[];
    expect(inputs.map((el) => el.value)).toContain('2026.08.19');
  });
});
