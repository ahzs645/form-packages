/**
 * useMoisTempData — the real MOIS `useTempData(tempArea, initialTempArea)`
 * contract, for the reproductions that call the host hook (SubForm).
 *
 * SMOIS evidence (~/github/smois/build/static/js/main.a75cc6b1.chunk.js,
 * MoisHooks module 10, export `useTempData`):
 *
 *   ne=function(e,t){var n,r,o=c(),a=Object(p.a)(o,1)[0];
 *     return Object(i.useEffect)((function(){var n;
 *       if(e&&(null===(n=a.tempArea)||void 0===n||!n[e]))
 *         return a.setFormData(Object(U.z)((function(n){n.tempArea||(n.tempArea={}),
 *           n.tempArea[e]||(n.tempArea[e]=Object(l.a)({},t))}))),
 *         function(){a.setFormData(Object(U.z)((function(t){var n;
 *           null!==(n=t.tempArea)&&void 0!==n&&n[e]&&(t.tempArea[e]={})})))}}),[]),
 *     e?[{activeSelector:function(t){var n,i;return null!==(n=null===(i=t.tempArea)||void 0===i?void 0:i[e])&&void 0!==n?n:{}}},
 *        null!==(n=null===(r=a.tempArea)||void 0===r?void 0:r[e])&&void 0!==n?n:{}]
 *      :[null,null]}
 *
 * That is:
 * - on mount only, when `tempArea` is named and `fd.tempArea[tempArea]` does
 *   not exist yet, create it as a shallow copy of `initialTempArea`, and on
 *   unmount reset it to `{}` (only when this call created it);
 * - return `[sectionOverride, currentTempData]`, where the section override is
 *   `{ activeSelector: fd => fd.tempArea?.[tempArea] ?? {} }`, or
 *   `[null, null]` when no area is named.
 *
 * SubForm calls it directly, and the form-scope `useTempData` (mock-hooks.ts)
 * is this hook, so a form's own call gets the same contract. A control's
 * write through the returned section lands in the temp area only
 * (`writeSectionActiveFieldValue`), never in `field.data`.
 */

import React from 'react';
import { produce, useActiveData } from '../context/MoisContext';

type TempAreaSection = { activeSelector: (fd: any) => any };

export function useMoisTempData(
  tempArea?: string | null,
  initialTempArea?: Record<string, unknown> | null
): [TempAreaSection | null, Record<string, any> | null] {
  const [activeData] = useActiveData();
  const activeDataRef = React.useRef(activeData);
  activeDataRef.current = activeData;

  React.useEffect(() => {
    const current = activeDataRef.current as any;
    if (!tempArea || current?.tempArea?.[tempArea]) return undefined;
    current.setFormData(
      produce((draft: any) => {
        if (!draft.tempArea) draft.tempArea = {};
        if (!draft.tempArea[tempArea]) draft.tempArea[tempArea] = { ...(initialTempArea ?? {}) };
      })
    );
    return () => {
      activeDataRef.current.setFormData(
        produce((draft: any) => {
          if (draft.tempArea?.[tempArea]) draft.tempArea[tempArea] = {};
        })
      );
    };
    // Mount-only, as in the engine (dependency list `[]`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!tempArea) return [null, null];
  return [
    { activeSelector: (fd: any) => fd?.tempArea?.[tempArea] ?? {} },
    (activeData as any)?.tempArea?.[tempArea] ?? {},
  ];
}

export default useMoisTempData;
