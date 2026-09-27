/**
 * SubForm Component
 * Sub-form with optional focus trap. If a default action is given then the
 * subform is inline and that action is taken when focus leaves the subform. If
 * there is no default action, then the subform will be a modal dialog.
 *
 * Fidelity (2026-09-27): reproduces the engine's SubForm verbatim. SMOIS
 * evidence, ~/github/smois/build/static/js/main.a75cc6b1.chunk.js, module 9
 * export "A" (MoisControl.SubForm):
 *
 *   en=["children","hidden","inline","label","lockPolicy","minWidth","moisModule",
 *       "onCancel","onDefaultAction","section","style","tempArea","initialTempArea"],
 *   tn=function(e){var t=e.children,n=e.hidden,i=void 0!==n&&n,c=e.inline,d=e.label,
 *     s=e.lockPolicy,b=void 0===s?null:s,p=e.minWidth,v=e.moisModule,m=e.onCancel,
 *     j=e.onDefaultAction,f=e.section,O=e.style,h=void 0===O?{}:O,y=e.tempArea,
 *     x=e.initialTempArea,g=Object(r.a)(e,en),I=Object(M.useTheme)();
 *     j||(h=Object(o.a)(Object(o.a)({},I.mois.inlineSubformStyle),h));
 *     var S=Object(M.useTempData)(y,x),C=Object(a.a)(S,1)[0];
 *     C&&(f=Object(o.a)(Object(o.a)({},C),f)),Object(M.useFormLock)(i?null:b);
 *     ...onBlur/useEffect: when onDefaultAction is set and focus has left the
 *        subform (or a "dropdownItemsWrapper-" popup), call onDefaultAction...
 *     return c||j ? i?null:<div ref onBlur><FocusTrapZone style={h} forceFocusInsideTrap={!j}>
 *         {f ? <Section {...f}>{t}</Section>
 *            : <><div style={{fontSize:"20px",fontWeight:600,marginBottom:"10px"}}>{d}{v&&<LinkToMois moisModule={v}/>}</div>{t}</>}
 *       </FocusTrapZone></div>
 *     : <Dialog title={<div>{d}{v&&<LinkToMois moisModule={v}/>}</div>} hidden={i}
 *         onDismiss={m} minWidth={p} modalProps={{isBlocking:true}} {...g}>
 *         {f ? <Section {...f}>{t}</Section> : <>{t}</>}
 *       </Dialog>}
 *
 * (`B.E` is MoisControl.Section, module 220; `Xt.a` is Fluent FocusTrapZone.)
 * So: `tempArea` binds the children to `fd.tempArea[tempArea]` (seeded from
 * `initialTempArea`) through the section context, `lockPolicy` is held while
 * the subform is shown, the modal is blocking with the label as its title, and
 * every other prop goes to the Dialog. The host hooks are the preview's
 * adaptation layer: `useFormLock` from mock-hooks (mois-contract lock state)
 * and the engine-faithful `useMoisTempData` (hooks/temp-data.ts).
 *
 * Preview-only additions, which never change saved data: `authorshipPolicy`
 * (the authorship model's section policy) and the `data-component="SubForm"`
 * marker on the section wrapper (a `display: contents` div when the engine
 * renders the children bare).
 */

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  PrimaryButton,
  DefaultButton,
  IDialogProps,
  IDropdownOption,
  FocusTrapZone,
} from '@fluentui/react';
import {
  useActiveData,
  produce,
  useTheme,
  SectionContext,
  SectionContextValue,
} from '../context/MoisContext';
import { Column } from './Column';
import { SimpleCodeSelect } from './SimpleCodeSelect';
import { TextArea } from './TextArea';
import { ButtonBar } from './ButtonBar';
import { SaveButton } from '../components/SaveButton';
import { Action } from './Action';
import { LinkToMois } from '../components/LinkToMois';
import { readSectionActiveFieldValue, writeSectionActiveFieldValue } from '../runtime/mois-contract';
import type { MoisFormLockPolicy } from '../runtime/mois-contract';
import { useFormLock } from '../hooks/mock-hooks';
import { useMoisTempData } from '../hooks/temp-data';

/** Section settings a SubForm passes to its engine `Section` (module 220). */
export type SubFormSection = Partial<SectionContextValue> & {
  isComplete?: boolean;
  focusZone?: boolean;
};

export interface SubFormOwnProps {
  /** Child controls to render in the subform */
  children?: React.ReactNode;
  /** Dialog minimum width (modal mode); passed to the Dialog as is */
  minWidth?: string | number;
  /** Hidden subforms render nothing and hold no lock */
  hidden?: boolean;
  /** Initial contents of `fd.tempArea[tempArea]` */
  initialTempArea?: Record<string, unknown> | null;
  /** If true, renders inline instead of as a modal dialog */
  inline?: boolean;
  /** Label for this subform (the dialog title, or the inline heading) */
  label?: React.ReactNode;
  /** Form lock held while the subform is shown (useFormLock) */
  lockPolicy?: MoisFormLockPolicy | null;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** Called when the dialog is dismissed (close button or Escape) */
  onCancel?: () => void;
  /** Default action when focus leaves (makes subform inline) */
  onDefaultAction?: () => void;
  /** Preview adaptation: authorship locking policy for controls inside the subform */
  authorshipPolicy?: SectionContextValue['authorshipPolicy'];
  /** Section settings for the children (activeSelector, layout, ...) */
  section?: SubFormSection;
  /** Inline mode: style of the focus trap zone (modal mode ignores it) */
  style?: React.CSSProperties;
  /** Name of the `fd.tempArea` entry the children read and write */
  tempArea?: string | null;
}

/** Any other prop is passed to the Dialog, as in the engine. */
export type SubFormProps = SubFormOwnProps &
  Omit<Partial<IDialogProps>, keyof SubFormOwnProps | 'title' | 'onDismiss'>;

/**
 * The engine `Section` (module 220) the SubForm wraps its children in:
 * sectionNum, readOnlyOptions and the selectors inherit, layout defaults to
 * "linear" and fieldPlacement does not inherit, and the children render in a
 * div. The engine Section also writes the inherited completion back to
 * `uiState.sections[sectionNum].isComplete`; that write is left out here,
 * because preview section contexts do not carry the engine's completion
 * reader (their default `sectionComplete` answers false), so repeating it
 * would reopen a completed preview form.
 */
const SubFormSectionProvider: React.FC<{
  section: SubFormSection;
  authorshipPolicy?: SectionContextValue['authorshipPolicy'];
  children?: React.ReactNode;
}> = ({ section, authorshipPolicy, children }) => {
  const parent = useContext(SectionContext);
  const ref = useRef<HTMLDivElement>(null);
  const {
    sectionNum: sectionNumProp,
    layout = 'linear',
    fieldPlacement,
    focusZone,
    readOnlyOptions,
    activeSelector,
    statusSelector,
    sourceSelector,
    sectionComplete,
  } = section;
  const sectionNum = sectionNumProp ?? parent.sectionNum;

  const value = useMemo<SectionContextValue>(() => ({
    sectionNum,
    layout,
    fieldPlacement,
    readOnlyOptions: readOnlyOptions ?? parent.readOnlyOptions,
    activeSelector: activeSelector ?? parent.activeSelector,
    statusSelector: statusSelector ?? parent.statusSelector,
    sourceSelector: sourceSelector ?? parent.sourceSelector,
    sectionComplete: sectionComplete ?? parent.sectionComplete,
    focusZoneRoot: focusZone ? ref.current : parent.focusZoneRoot,
    authorshipPolicy: authorshipPolicy ?? section.authorshipPolicy ?? parent.authorshipPolicy,
  }), [
    parent,
    sectionNum,
    layout,
    fieldPlacement,
    readOnlyOptions,
    activeSelector,
    statusSelector,
    sourceSelector,
    sectionComplete,
    focusZone,
    authorshipPolicy,
    section.authorshipPolicy,
  ]);

  return (
    <div ref={ref} data-component="SubForm">
      <SectionContext.Provider value={value}>{children}</SectionContext.Provider>
    </div>
  );
};

/**
 * SubForm - Sub-form with optional focus trap and modal/inline modes
 */
export const SubForm: React.FC<SubFormProps> = ({
  children,
  hidden = false,
  inline,
  label,
  lockPolicy = null,
  minWidth,
  moisModule,
  onCancel,
  onDefaultAction,
  section,
  style = {},
  tempArea,
  initialTempArea,
  authorshipPolicy,
  ...dialogProps
}) => {
  const theme = useTheme();
  let effectiveStyle: React.CSSProperties = style;
  if (!onDefaultAction) effectiveStyle = { ...(theme?.mois?.inlineSubformStyle ?? {}), ...style };

  const [tempAreaSection] = useMoisTempData(tempArea, initialTempArea);
  let effectiveSection: SubFormSection | undefined = section;
  if (tempAreaSection) effectiveSection = { ...tempAreaSection, ...section };

  useFormLock(hidden ? null : lockPolicy);

  const containerRef = useRef<HTMLDivElement>(null);
  const [blurred, setBlurred] = useState(false);
  useEffect(() => {
    if (!onDefaultAction || !blurred) return;
    let element: Element | null = document.activeElement;
    let focusInside = false;
    while (element) {
      const className = typeof element.className === 'string' ? element.className : '';
      if (element === containerRef.current || className.startsWith('dropdownItemsWrapper-')) {
        focusInside = true;
        break;
      }
      element = element.parentElement;
    }
    if (!focusInside) onDefaultAction();
    setBlurred(false);
  }, [blurred, onDefaultAction]);

  // The preview's authorship policy rides on the section the engine renders;
  // without a section, a policy still needs a provider for the children.
  if (!effectiveSection && authorshipPolicy) effectiveSection = {};

  const title = (
    <div>
      {label}
      {moisModule && <LinkToMois moisModule={moisModule} />}
    </div>
  );

  if (inline || onDefaultAction) {
    if (hidden) return null;
    return (
      <div ref={containerRef} onBlur={() => (onDefaultAction ? setBlurred(true) : undefined)}>
        <FocusTrapZone style={effectiveStyle} forceFocusInsideTrap={!onDefaultAction}>
          {effectiveSection ? (
            <SubFormSectionProvider section={effectiveSection} authorshipPolicy={authorshipPolicy}>
              {children}
            </SubFormSectionProvider>
          ) : (
            <div data-component="SubForm" style={{ display: 'contents' }}>
              <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}>
                {label}
                {moisModule && <LinkToMois moisModule={moisModule} />}
              </div>
              {children}
            </div>
          )}
        </FocusTrapZone>
      </div>
    );
  }

  return (
    <Dialog
      title={title as any}
      hidden={hidden}
      onDismiss={onCancel}
      minWidth={minWidth}
      // Blocking, as in the engine: Fluent then shows the top-right close
      // button (showCloseButton: isBlocking) and ignores overlay clicks.
      modalProps={{ isBlocking: true }}
      {...dialogProps}
    >
      {effectiveSection ? (
        <SubFormSectionProvider section={effectiveSection} authorshipPolicy={authorshipPolicy}>
          {children}
        </SubFormSectionProvider>
      ) : (
        <div data-component="SubForm" style={{ display: 'contents' }}>
          {children}
        </div>
      )}
    </Dialog>
  );
};

// Shared dropdown options
const yesNoOptions: IDropdownOption[] = [
  { key: '', text: 'Please select' },
  { key: 'Y', text: 'Yes' },
  { key: 'N', text: 'No' },
  { key: 'U', text: 'Unknown' },
];

const genderOptions: IDropdownOption[] = [
  { key: '', text: 'Please select' },
  { key: 'M', text: 'Male' },
  { key: 'F', text: 'Female' },
  { key: 'NB', text: 'Non-binary' },
  { key: 'O', text: 'Other' },
];

/**
 * SubFormDemo1 - Modal pop-up dialog example
 */
export const SubFormDemo1: React.FC = () => {
  const [fd] = useActiveData();
  const [showDialog, setShowDialog] = useState(false);
  const [comment, setComment] = useState('');

  return (
    <>
      <SaveButton
        text="Show Dialog"
        onClick={() => setShowDialog(true)}
      />

      <SubForm
        label="Enter new contents"
        moisModule="demographics"
        hidden={!showDialog}
        minWidth={480}
        onCancel={() => setShowDialog(false)}
      >
        <Column>
          <SimpleCodeSelect
            size="small"
            label="Ready to chose?"
            fieldId="input2choice"
            codeSystem="MOIS-YESNOUNKNOWN"
          />
          <TextArea
            size="medium"
            label="Comments"
            multiline
            fieldId="input2comments"
          />
        </Column>
        <ButtonBar horizontalAlign="end">
          <PrimaryButton
            text="Save"
            onClick={() => {
              setComment(fd?.field?.data?.input2comments || '');
              setShowDialog(false);
            }}
          />
          <DefaultButton text="Cancel" onClick={() => setShowDialog(false)} />
        </ButtonBar>
      </SubForm>

      <TextArea
        size="large"
        multiline
        label="Last comment"
        readOnly
        value={comment}
      />
    </>
  );
};

/**
 * SubFormDemo2 - Inline with focus trap (dropdown + textarea example)
 */
export const SubFormDemo2: React.FC = () => {
  const [fd] = useActiveData();
  const [editing, setEditing] = useState(false);
  const [comment, setComment] = useState('');

  if (!editing) {
    return (
      <TextArea
        label="Last comment"
        size="large"
        multiline
        readOnly
        value={comment}
        actions={{ onEdit: () => setEditing(true) }}
      />
    );
  }

  return (
    <SubForm label="Inline example" inline hidden={!editing} minWidth={300} onCancel={() => setEditing(false)}>
      <Column>
        <SimpleCodeSelect
          size="small"
          label="Ready to chose?"
          fieldId="input1choice"
          codeSystem="MOIS-YESNOUNKNOWN"
        />
        <TextArea
          size="medium"
          label="Comments"
          multiline
          fieldId="input1comments"
        />
        <Action.Bar
          onAccept={() => {
            setComment(fd?.field?.data?.input1comments || '');
            setEditing(false);
          }}
          onCancel={() => {
            setEditing(false);
          }}
        />
      </Column>
    </SubForm>
  );
};

/**
 * SubFormDemo3 - Inline with immediate update (dropdown example)
 */
export const SubFormDemo3: React.FC = () => {
  const fieldName = 'inlineImmediateUpdate';
  const label = 'Prefered gender';
  const codeSystem = 'MOIS-PREFERREDGENDER';

  const [fd, setFd] = useActiveData();
  const [editing, setEditing] = useState<{ code: string; display: string; system: string } | null>(null);
  const [gender, setGender] = useState({
    code: '',
    display: '',
    system: codeSystem,
  });

  const handleSelection = (id: string) => {
    setGender(readSectionActiveFieldValue(fd, undefined, id) as any);
    setEditing(null);
  };

  const handleCancelSelection = (id: string) => {
    setGender(editing!);
    setFd(
      produce((draft: any) => {
        writeSectionActiveFieldValue(draft, undefined, id, editing);
      })
    );
    setEditing(null);
  };

  return (
    <>
      {!editing ? (
        <>
          <SimpleCodeSelect
            id={fieldName}
            label={label}
            placeholder="Gender not recorded"
            actions={{ onEdit: () => setEditing(gender) }}
            readOnly
          />
        </>
      ) : (
        <SubForm inline hidden={!editing} onDefaultAction={() => {}}>
          <SimpleCodeSelect
            id={fieldName}
            label={label}
            codeSystem={codeSystem}
            actions={{
              onCancel: () => handleCancelSelection(fieldName),
              onAccept: () => handleSelection(fieldName),
            }}
          />
        </SubForm>
      )}
    </>
  );
};

export default SubForm;
