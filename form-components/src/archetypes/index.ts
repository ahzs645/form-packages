/**
 * MOIS Archetypes
 * Data model components for MOIS forms
 */

export { AssociatedParty } from './AssociatedParty';
export { ChartPreference } from './ChartPreference';
export { Connection } from './Connection';
export { Correspondence } from './Correspondence';
export { Encounter } from './Encounter';
export { Observation } from './Observation';
export { ObservationPanel } from './ObservationPanel';
export { Patient } from './Patient';
export { Query } from './Query';
export { Task } from './Task';

// Import for Mois namespace
import { AssociatedParty } from './AssociatedParty';
import { ChartPreference } from './ChartPreference';
import { Connection } from './Connection';
import { Correspondence } from './Correspondence';
import { Encounter } from './Encounter';
import { Observation } from './Observation';
import { ObservationPanel } from './ObservationPanel';
import { Patient as PatientArchetype } from './Patient';
import { Query } from './Query';
import { Task } from './Task';

// Create Patient with Query sub-property for Mois.Patient.Query pattern
const PatientWithQuery = Object.assign({}, PatientArchetype, { Query });

/**
 * Mois namespace containing all archetypes
 */
export const Mois = {
  AssociatedParty,
  ChartPreference,
  Connection,
  Correspondence,
  Encounter,
  Observation,
  ObservationPanel,
  Patient: PatientWithQuery,
  Query,
  Task,
};
