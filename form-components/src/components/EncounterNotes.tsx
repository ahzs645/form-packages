/**
 * EncounterNotes Component
 * Shows the existing progress notes attached to the specified encounter and
 * optionally allows the user to add new notes and edit existing ones.
 *
 * Uses reusable controls: ButtonBar, Action.Bar, SubForm, OptionChoice, UserProfile, Markdown
 */

import React, { useState } from 'react';
import { TextField, Label, DefaultButton, PrimaryButton } from '@fluentui/react';
import { useSourceData } from '../context/MoisContext';

// Import reusable controls
import { ButtonBar } from '../controls/ButtonBar';
import { Action } from '../controls/Action';
import { SubForm } from '../controls/SubForm';
import { OptionChoice } from '../controls/OptionChoice';
import { Markdown } from '../controls/Markdown';
import { LayoutItem } from '../controls/LayoutItem';
import { UserProfile, Coding } from '../components/UserProfile';

// Encounter note type
export interface EncounterNoteType {
  encounterNoteId: number;
  encounterId: number;
  authorUserProfileId: number;
  creatorUserProfileId: number;
  note: string;
  noteCreationDate: string;
  isComplete?: { code: string; display: string };
  extraInfo?: string | null;
  extraInfoTemplate?: string | null;
  stamp?: {
    createUser: string;
    createTime: string;
    modifyUser?: string;
  };
}

// Encounter type with notes
export interface EncounterType {
  encounterId: number;
  patientId: number;
  providerId?: number;
  notes?: EncounterNoteType[];
}

export interface EncounterNotesProps {
  /** Default author user profile ID */
  defaultAuthorId?: string;
  /** Encounter to update with new or changed notes */
  encounter?: EncounterType;
  /** ID for the Encounter to update */
  encounterId?: number;
  /** Label shown at the top of the progress note list */
  label?: string;
  /** Template for newly created encounter notes */
  noteTemplate?: Partial<EncounterNoteType>;
  /** Note content type */
  noteType?: 'text' | 'markdown';
  /** Callback if a new note is added or changed */
  onNotesChanged?: () => void;
  /** Read Only */
  readOnly?: boolean;
}

// Format date for display (YYYY.MM.DD)
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA').replace(/-/g, '.');
  } catch {
    return dateStr;
  }
};

// Sort notes by creation date (newest first)
const sortNotesByDate = (a: EncounterNoteType, b: EncounterNoteType): number => {
  const dateA = new Date(a.noteCreationDate || a.stamp?.createTime || 0);
  const dateB = new Date(b.noteCreationDate || b.stamp?.createTime || 0);
  return dateB.getTime() - dateA.getTime();
};

// Complete/Incomplete coding values
const COMPLETE_YES: { code: string; display: string } = { code: 'Y', display: 'Yes' };
const COMPLETE_NO: { code: string; display: string } = { code: 'N', display: 'No' };

// Note state for editing
interface NoteState {
  note: string;
  author: Coding;
  isComplete: { code: string; display: string };
}

// ============================================
// NoteEditorContent - Shared editor content (used inline and in modal)
// ============================================
interface NoteEditorContentProps {
  acceptButtonText?: string;
  defaultAuthorId?: string;
  note?: EncounterNoteType;
  noteType: 'text' | 'markdown';
  onAccept: (state: NoteState) => void;
  onCancel: () => void;
}

const NoteEditorContent: React.FC<NoteEditorContentProps> = ({
  acceptButtonText = 'Add Note',
  defaultAuthorId,
  note,
  noteType,
  onAccept,
  onCancel,
}) => {
  const sourceData = useSourceData() as any;

  // Determine default author
  const authorId = defaultAuthorId || note?.authorUserProfileId || note?.creatorUserProfileId;
  const authorName = sourceData?.userProfile?.identity?.fullName || '';
  const defaultAuthor: Coding = {
    code: String(authorId || ''),
    display: authorName,
  };

  const [state, setState] = useState<NoteState>({
    note: note?.note || '',
    author: defaultAuthor,
    isComplete: note?.isComplete || COMPLETE_NO,
  });

  const handleConfirm = () => onAccept(state);

  return (
    <>
      <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '10px' }}></div>

      {/* Note content - Markdown or TextField */}
      {noteType === 'markdown' ? (
        <Markdown
          height={300}
          size="100%"
          startingMode="edit"
          value={state.note}
          readOnly={false}
          onChange={(_e: any, newValue?: string) =>
            setState({ ...state, note: newValue || '' })
          }
        />
      ) : (
        <TextField
          multiline
          rows={17}
          value={state.note}
          onChange={(_e, newValue) =>
            setState({ ...state, note: newValue || '' })
          }
        />
      )}

      {/* Author and Complete toggle row */}
      <div
        style={{
          display: 'flex',
          flexFlow: 'row',
          justifyContent: 'flex-start',
          columnGap: '20px',
          alignItems: 'flex-end',
        }}
      >
        {/* Author field - noTopLabel so TextField uses its own label */}
        <LayoutItem noTopLabel size="medium">
          <TextField
            label="Author"
            required
            placeholder="Please search"
            value={state.author.display || ''}
            onChange={(_e, newValue) =>
              setState({ ...state, author: { ...state.author, display: newValue || '' } })
            }
          />
        </LayoutItem>

        {/* Complete toggle - noTopLabel, toggle handles its own display */}
        <LayoutItem noTopLabel size="small">
          <OptionChoice
            displayStyle="toggle"
            placeholder="Not complete"
            yesText="Complete"
            noText="Not complete"
            value={state.isComplete}
            onChange={(_e: any, checked?: boolean) =>
              setState({ ...state, isComplete: checked ? COMPLETE_YES : COMPLETE_NO })
            }
          />
        </LayoutItem>

        <div style={{ marginLeft: '2em' }}></div>
      </div>

      {/* Action buttons - right aligned */}
      <ButtonBar horizontalAlign="end" padding="10px">
        <PrimaryButton text={acceptButtonText} onClick={handleConfirm} />
        <DefaultButton text="Cancel" onClick={onCancel} />
      </ButtonBar>
    </>
  );
};

// ============================================
// NewNoteModal - Modal dialog for adding new notes
// ============================================
interface NewNoteModalProps {
  defaultAuthorId?: string;
  noteType: 'text' | 'markdown';
  onAccept: (state: NoteState) => void;
  onCancel: () => void;
}

const NewNoteModal: React.FC<NewNoteModalProps> = ({
  defaultAuthorId,
  noteType,
  onAccept,
  onCancel,
}) => {
  return (
    <SubForm
      onCancel={onCancel}
      minWidth={800}
      label="New note"
    >
      <NoteEditorContent
        acceptButtonText="Add Note"
        defaultAuthorId={defaultAuthorId}
        noteType={noteType}
        onAccept={onAccept}
        onCancel={onCancel}
      />
    </SubForm>
  );
};

// ============================================
// EncounterNote - Single note display
// ============================================
interface EncounterNoteProps {
  note: EncounterNoteType;
  noteType: 'text' | 'markdown';
  readOnly?: boolean;
  onNoteChanged?: () => void;
}

const EncounterNote: React.FC<EncounterNoteProps> = ({
  note,
  noteType,
  readOnly,
  onNoteChanged,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const authorName = note.stamp?.modifyUser || note.stamp?.createUser || 'Unknown author';
  const noteDate = formatDate(note.noteCreationDate || note.stamp?.createTime || '');
  const noteLabel = note.extraInfoTemplate || 'Progress';
  const isComplete = note.isComplete?.code === 'Y';

  const handleUpdateNote = (state: NoteState) => {
    console.log('Update note:', state);
    setIsEditing(false);
    onNoteChanged?.();
  };

  return (
    <div>
      {/* Note header with edit action */}
      <div style={{ display: 'flex' }}>
        <Label>
          {noteLabel} Note from {authorName} on {noteDate}{' '}
          {isComplete ? '' : '(Incomplete)'}
        </Label>
        {!readOnly && (
          <Action.Bar onEdit={() => setIsEditing(true)} />
        )}
      </div>

      {/* Note content - show inline editor or display */}
      {isEditing ? (
        <div>
          <NoteEditorContent
            note={note}
            noteType={noteType}
            acceptButtonText="Revise note"
            onAccept={handleUpdateNote}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : noteType === 'markdown' ? (
        <Markdown source={note.note} readOnly />
      ) : (
        <TextField
          multiline
          value={note.note}
          readOnly
          borderless
          autoAdjustHeight
          resizable={false}
        />
      )}

      <hr />
    </div>
  );
};

// ============================================
// EncounterNotes - Main component
// ============================================
export const EncounterNotes: React.FC<EncounterNotesProps> = ({
  defaultAuthorId,
  encounter: propEncounter,
  encounterId,
  label = 'Progress Notes',
  noteTemplate,
  noteType = 'text',
  onNotesChanged = () => {},
  readOnly,
}) => {
  const sourceData = useSourceData() as any;
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Get encounter from props or source data
  const encounter = propEncounter || sourceData?.webform?.encounter;
  const notes = encounter?.notes || [];

  // Sort notes by date
  const sortedNotes = [...notes].sort(sortNotesByDate);

  const handleAddNote = (state: NoteState) => {
    console.log('Add note:', state);
    setIsAddingNote(false);
    onNotesChanged();
  };

  return (
    <>
      {/* Section title */}
      <div
        style={{
          fontSize: 'x-large',
          margin: '20px 0',
          fontWeight: 'bold',
        }}
      >
        {label}
      </div>

      {/* Existing notes */}
      {sortedNotes.map((note: EncounterNoteType) => (
        <EncounterNote
          key={note.encounterNoteId}
          note={note}
          noteType={noteType}
          readOnly={readOnly}
          onNoteChanged={onNotesChanged}
        />
      ))}

      {/* Add note button - wrapped in ButtonBar */}
      {!readOnly && (
        <ButtonBar>
          <DefaultButton
            iconProps={{ iconName: 'AddNotes' }}
            text="New note"
            onClick={() => setIsAddingNote(true)}
          />
        </ButtonBar>
      )}

      {/* New note modal */}
      {isAddingNote && (
        <NewNoteModal
          defaultAuthorId={defaultAuthorId}
          noteType={noteType}
          onAccept={handleAddNote}
          onCancel={() => setIsAddingNote(false)}
        />
      )}
    </>
  );
};

export default EncounterNotes;
