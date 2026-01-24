/**
 * BenefitPlans Component
 * Display a list of the patients insurance benefit plans and payors.
 *
 * Uses reusable controls: ListSelection (wrapper pattern)
 *
 * Note: This component transforms nested benefitPayorCoverages data into a flat list
 * and passes it as `items` to ListSelection with sourceId/id undefined.
 */

import React, { useMemo } from 'react';
import { IColumn } from '@fluentui/react';
import { ListSelection, ListSelectionProps } from '../controls/ListSelection';
import { useSourceData } from '../context/MoisContext';

// Benefit plan coverage item (flattened for display)
export interface BenefitPlanCoverage {
  benefitPlanCoverageId?: number;
  benefitPayorCoverageId?: number;
  source: string;
  plan: string;
  coverage: string;
}

// Source data structure from patient
interface BenefitPayorCoverage {
  benefitPayorCoverageId?: number;
  payor?: { display?: string };
  benefitPlanCoverages?: Array<{
    benefitPlanCoverageId?: number;
    plan?: { display?: string };
    coverage?: string;
  }>;
}

export interface BenefitPlansProps {
  /** Active field name */
  fieldId?: string;
  /** Hidden fields are not shown at all */
  hidden?: boolean;
  /** List index used to distinguish rows/columns in grid and flowsheet layouts */
  index?: number;
  /** Label for this field */
  label?: string;
  /** Override Props for the underlying ListSelection control */
  listSelectionProps?: Partial<ListSelectionProps>;
  /** Link to module in MOIS windows client */
  moisModule?: string;
  /** A readOnly control is always view only */
  readOnly?: boolean;
  /** Change selection button text */
  selectText?: string;
  /** Selection type for the list */
  selectionType?: 'none' | 'single' | 'multiple';
  /** Source field name */
  sourceId?: string;
}

// Pre-configured columns for benefit plan coverage display
const benefitPlanColumns: IColumn[] = [
  {
    key: 'source',
    name: 'Source',
    fieldName: 'source',
    minWidth: 340,
    maxWidth: 340,
    isMultiline: true,
  },
  {
    key: 'plan',
    name: 'Plan',
    fieldName: 'plan',
    minWidth: 340,
    maxWidth: 340,
    isMultiline: true,
  },
  {
    key: 'coverage',
    name: 'Coverage',
    fieldName: 'coverage',
    minWidth: 190,
    maxWidth: 190,
    isMultiline: true,
  },
];

/**
 * BenefitPlans - A pre-configured ListSelection for benefit plan display.
 * Transforms nested benefitPayorCoverages data into a flat list for display.
 */
export const BenefitPlans: React.FC<BenefitPlansProps> = ({
  fieldId = 'benefitPlanCoverages',
  sourceId = 'benefitPayorCoverages',
  selectText = 'Select benefit plans',
  selectionType = 'none',
  label,
  hidden = false,
  moisModule,
  readOnly,
  listSelectionProps = {},
  ...restProps
}) => {
  const sourceData = useSourceData();

  // Transform nested data structure into flat list
  const items = useMemo(() => {
    const payorCoverages = (sourceData as any)?.patient?.[sourceId] as BenefitPayorCoverage[] | undefined;

    if (!payorCoverages || payorCoverages.length === 0) {
      return [];
    }

    const flatList: BenefitPlanCoverage[] = [];

    payorCoverages.forEach((payorCov) => {
      payorCov.benefitPlanCoverages?.forEach((planCov) => {
        flatList.push({
          benefitPlanCoverageId: planCov.benefitPlanCoverageId,
          source: payorCov.payor?.display ?? '-',
          plan: planCov.plan?.display ?? '-',
          coverage: planCov.coverage ?? '-',
          benefitPayorCoverageId: payorCov.benefitPayorCoverageId,
        });
      });
    });

    return flatList;
  }, [sourceData, sourceId]);

  // Don't render if hidden
  if (hidden) return null;

  return (
    <div style={{ marginLeft: '2em' }}>
      <ListSelection
        fieldId={fieldId}
        sourceId={undefined}
        id={undefined}
        items={items}
        label={label}
        selectText={selectText}
        selectionType={selectionType}
        columns={benefitPlanColumns}
        moisModule={moisModule}
        readOnly={readOnly}
        {...restProps}
        {...listSelectionProps}
      />
    </div>
  );
};

export default BenefitPlans;
