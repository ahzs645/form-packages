/**
 * Mock Code Lists
 * Default code lists for form dropdowns and selections
 *
 * This module imports the optionLists from the MOIS data and transforms
 * them into the CodeListItem format expected by useCodeList hook.
 */

import optionListsData from '../data/optionLists.json';

export interface CodeListItem {
  code: string;
  display: string;
  system: string;
}

/**
 * Transform raw option lists from { code: display } format to CodeListItem[] format
 */
function transformOptionLists(
  rawData: Record<string, Record<string, string>>
): Record<string, CodeListItem[]> {
  const result: Record<string, CodeListItem[]> = {};

  for (const [system, codes] of Object.entries(rawData)) {
    result[system] = Object.entries(codes).map(([code, display]) => ({
      code,
      display,
      system,
    }));
  }

  return result;
}

const NONE_PRESENT = {
  NONE: 'None',
  PRESENT: 'Present',
};

const ABSENT_PRESENT = {
  ABSENT: 'Absent',
  PRESENT: 'Present',
};

const SEVERITY_SCALE = {
  NONE: 'None',
  MILD: 'Mild',
  MODERATE: 'Moderate',
  SEVERE: 'Severe',
};

/**
 * Preview-only supplements for legacy NHForms code systems that are loaded from
 * MOIS MemoryCode in Shimmed. These keep component-harness previews close to
 * the target runtime without claiming the lists are canonical clinical values.
 */
export const supplementalOptionLists: Record<string, Record<string, string>> = {
  'MOIS-PREFSUBJECTCODE': {
    '04001': 'TELEPHONE RISK ASSESSMENT',
    '04002': 'VIOLENCE RISK ASSESSMENT',
    '04003': 'HOME RISK ASSESSMENT',
  },
  'MOIS-PANELNAME': {
    MSE: 'Mental Status Exam',
    PHQ2: 'PHQ-2',
    PHQ9: 'PHQ-9',
    GAD7: 'GAD-7',
    HFC: 'Health functional checklist',
    DEV: 'Developer sample panel',
  },
  'MSE-AFFECT': {
    EUTHYMIC: 'Euthymic',
    ANXIOUS: 'Anxious',
    DEPRESSED: 'Depressed',
    IRRITABLE: 'Irritable',
    LABILE: 'Labile',
  },
  'MSE-AFFECTINTENSITY': {
    NORMAL: 'Normal',
    HEIGHTENED: 'Heightened',
    REDUCED: 'Reduced',
  },
  'MSE-AFFECTRANGE': {
    FULL: 'Full',
    CONSTRICTED: 'Constricted',
    BLUNTED: 'Blunted',
    FLAT: 'Flat',
  },
  'MSE-AFFECTSTABILITY': {
    STABLE: 'Stable',
    LABILE: 'Labile',
  },
  'MSE-AGITATION': SEVERITY_SCALE,
  'MSE-ALERTNESS': {
    ALERT: 'Alert',
    DROWSY: 'Drowsy',
    OBTUNDED: 'Obtunded',
  },
  'MSE-APPROPRIATENESS': {
    APPROPRIATE: 'Appropriate',
    INAPPROPRIATE: 'Inappropriate',
    CONGRUENT: 'Congruent',
    INCONGRUENT: 'Incongruent',
  },
  'MSE-ARTICULATION': {
    CLEAR: 'Clear',
    SLURRED: 'Slurred',
    MUMBLED: 'Mumbled',
  },
  'MSE-ATTENTIVENESS': {
    ATTENTIVE: 'Attentive',
    DISTRACTIBLE: 'Distractible',
    DROWSY: 'Drowsy',
  },
  'MSE-CATATONIA': ABSENT_PRESENT,
  'MSE-COGNITIVE': {
    INTACT: 'Grossly intact',
    IMPAIRED: 'Impaired',
    FLUCTUATING: 'Fluctuating',
  },
  'MSE-COOPERATION': {
    COOPERATIVE: 'Cooperative',
    PASSIVE: 'Passive',
    RESISTIVE: 'Resistive',
  },
  'MSE-DELUSIONS': {
    NONE: 'None',
    PERSECUTORY: 'Persecutory',
    GRANDIOSE: 'Grandiose',
    SOMATIC: 'Somatic',
  },
  'MSE-DEPRESSIVECOGNITION': {
    NONE: 'None',
    GUILT: 'Guilt',
    HOPELESS: 'Hopelessness',
    WORTHLESS: 'Worthlessness',
  },
  'MSE-DRESS': {
    APPROPRIATE: 'Appropriate',
    DISHEVELED: 'Disheveled',
    SOILED: 'Soiled',
    INAPPROPRIATE: 'Inappropriate',
  },
  'MSE-EYECONTACT': {
    GOOD: 'Good',
    INTERMITTENT: 'Intermittent',
    POOR: 'Poor',
    AVOIDANT: 'Avoidant',
  },
  'MSE-GAIT': {
    NORMAL: 'Normal',
    SLOW: 'Slow',
    UNSTEADY: 'Unsteady',
    ATAXIC: 'Ataxic',
  },
  'MSE-GROOMING': {
    WELL: 'Well groomed',
    FAIR: 'Fair',
    POOR: 'Poor',
  },
  'MSE-HALLUCINATIONS': {
    NONE: 'None',
    AUDITORY: 'Auditory',
    VISUAL: 'Visual',
    TACTILE: 'Tactile',
    OTHER: 'Other',
  },
  'MSE-LOGIC': {
    LOGICAL: 'Logical',
    TANGENTIAL: 'Tangential',
    CIRCUMSTANTIAL: 'Circumstantial',
    LOOSE: 'Loose associations',
  },
  'MSE-MANNERS': {
    COOPERATIVE: 'Cooperative',
    GUARDED: 'Guarded',
    HOSTILE: 'Hostile',
  },
  'MSE-MEMORY': {
    INTACT: 'Intact',
    RECENT: 'Recent memory impaired',
    REMOTE: 'Remote memory impaired',
  },
  'MSE-MOOD': {
    EUTHYMIC: 'Euthymic',
    ANXIOUS: 'Anxious',
    DEPRESSED: 'Depressed',
    IRRITABLE: 'Irritable',
    ELEVATED: 'Elevated',
  },
  'MSE-MOODRATING': {
    '0': '0',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    '10': '10',
  },
  'MSE-OBSESSIONS': NONE_PRESENT,
  'MSE-PERSERVATION': ABSENT_PRESENT,
  'MSE-PHOBIAS': NONE_PRESENT,
  'MSE-POSITION': {
    RELAXED: 'Relaxed',
    RESTLESS: 'Restless',
    RIGID: 'Rigid',
  },
  'MSE-POSTURE': {
    NORMAL: 'Normal',
    SLOUCHED: 'Slouched',
    RIGID: 'Rigid',
  },
  'MSE-SELFCONCEPT': {
    APPROPRIATE: 'Appropriate',
    LOW: 'Low self-esteem',
    GRANDIOSE: 'Grandiose',
  },
  'MSE-SELFHARM': {
    DENIED: 'Denied',
    PASSIVE: 'Passive thoughts',
    ACTIVE: 'Active ideation',
    PLAN: 'Plan or intent',
  },
  'MSE-SPEECHAMOUNT': {
    NORMAL: 'Normal',
    POVERTY: 'Poverty of speech',
    EXCESSIVE: 'Excessive',
  },
  'MSE-SPEECHRATE': {
    NORMAL: 'Normal',
    SLOW: 'Slow',
    RAPID: 'Rapid',
    PRESSURED: 'Pressured',
  },
  'MSE-SPEECHRHYTHM': {
    NORMAL: 'Normal',
    HALTING: 'Halting',
    STUTTER: 'Stutter',
    LATENT: 'Latent',
  },
  'MSE-SPEECHVOLUME': {
    NORMAL: 'Normal',
    SOFT: 'Soft',
    LOUD: 'Loud',
    MUTE: 'Mute',
  },
  'MSE-THOUGHTSTREAM': {
    NORMAL: 'Normal',
    RACING: 'Racing',
    BLOCKED: 'Thought blocking',
    SLOWED: 'Slowed',
  },
  'MSE-UNUSUALMOVEMENTS': {
    ABSENT: 'Absent',
    TREMOR: 'Tremor',
    TICS: 'Tics',
    DYSKINESIA: 'Dyskinesia',
  },
  'VALUESET:BETTER.SAME.WORSE': {
    Better: 'BETTER',
    Same: 'SAME',
    Worse: 'WORSE',
    Yes: 'YES',
    No: 'NO',
  },
  'VALUESET:NYHA.NORMATIVE.ANSWER.LIST': {
    I: 'Class I',
    II: 'Class II',
    III: 'Class III',
    IV: 'Class IV',
  },
};

export const previewOptionListsRaw: Record<string, Record<string, string>> = {
  ...Object.fromEntries(
    Object.entries(optionListsData as Record<string, Record<string, string>>).map(([system, values]) => [
      system,
      {
        ...values,
        ...(supplementalOptionLists[system] ?? {}),
      },
    ])
  ),
  ...Object.fromEntries(
    Object.entries(supplementalOptionLists).filter(
      ([system]) => !Object.prototype.hasOwnProperty.call(optionListsData, system)
    )
  ),
};

/**
 * Mock code lists transformed from MOIS data
 * Contains all standard MOIS code systems like:
 * - MOIS-FIRSTNATIONSTATUS
 * - MOIS-ADMINISTRATIVEGENDER
 * - MOIS-YESNO
 * - AIHS-YESNO
 * - And many more...
 */
export const mockCodeLists: Record<string, CodeListItem[]> = transformOptionLists(
  previewOptionListsRaw
);

export default mockCodeLists;
