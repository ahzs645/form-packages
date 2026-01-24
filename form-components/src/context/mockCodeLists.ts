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
  optionListsData as Record<string, Record<string, string>>
);

export default mockCodeLists;
