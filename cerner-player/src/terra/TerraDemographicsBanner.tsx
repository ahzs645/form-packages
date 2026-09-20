import React from "react";

import { TERRA_MESSAGES } from "@webforms/cerner-terra";

/**
 * Patient banner mirroring Terra's demographics banner markup and tokens
 * (section > person-name + identifier-row of <dl> label/value pairs, values
 * bold).
 *
 * The Terra target now renders Terra's real `DemographicsBanner` — see
 * App.tsx. This reproduction stays for the MOIS-in-Cerner-look path, which
 * draws through Fluent and so has no terra-base to size a Terra component
 * against. Prop shapes are kept interchangeable with the real one.
 */

/**
 * Terra's own strings, so a row is labelled identically whichever banner the
 * target picked. `id` is the tail of `Terra.demographicsBanner.*`.
 */
const message = (id: string): string =>
  TERRA_MESSAGES[`Terra.demographicsBanner.${id}`] ?? id;

export interface TerraBannerIdentifier {
  label: string;
  value: string | number;
  /**
   * Spelled-out title for an abbreviated label ("FIN NBR" → "Financial
   * Number"). Terra puts it on an `<abbr title>` for pointer users *and*
   * repeats it as visually hidden text, because assistive technology
   * announces `abbr[title]` inconsistently; the `<abbr>` is then aria-hidden
   * so the abbreviation is not read twice.
   */
  longForm?: string;
}

export interface TerraDemographicsBannerProps {
  personName: string;
  preferredFirstName?: string;
  age?: string;
  gender?: string;
  dateOfBirth?: string;
  deceasedDate?: string;
  gestationalAge?: string;
  postMenstrualAge?: string;
  /** Label → value, matching Terra's own DemographicsBanner prop shape. */
  identifiers?: Record<string, string>;
  /** Label → spelled-out title, for the abbreviated labels in `identifiers`. */
  identifiersLongForm?: Record<string, string>;
  photo?: React.ReactNode;
  applicationContent?: React.ReactNode;
  /** Heading level for the person's name; Terra's own default is 2. */
  personNameHeadingLevel?: number;
}

const DetailList: React.FC<{ items: TerraBannerIdentifier[] }> = ({ items }) =>
  items.length === 0 ? null : (
    <dl>
      {items.map((item) => (
        <React.Fragment key={item.label}>
          <dt>
            {item.longForm ? (
              <>
                <span className="visually-hidden-text">{item.longForm}</span>
                <abbr className="abbreviation" title={item.longForm} aria-hidden="true">
                  {item.label}
                </abbr>
              </>
            ) : (
              item.label
            )}
          </dt>
          <dd>{item.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );

export const TerraDemographicsBanner: React.FC<TerraDemographicsBannerProps> = ({
  personName,
  preferredFirstName,
  age,
  gender,
  dateOfBirth,
  deceasedDate,
  gestationalAge,
  postMenstrualAge,
  identifiers = {},
  identifiersLongForm = {},
  photo,
  applicationContent,
  personNameHeadingLevel = 2,
}) => {
  // Terra's own order: age, gender, DOB, GA, PMA, then the deceased date.
  const details: TerraBannerIdentifier[] = [];
  if (age) details.push({ label: message("age"), value: age });
  if (gender) details.push({ label: message("gender"), value: gender });
  if (dateOfBirth)
    details.push({
      label: message("dateOfBirth"),
      value: dateOfBirth,
      longForm: message("dateOfBirthFullText"),
    });
  if (gestationalAge)
    details.push({
      label: message("gestationalAge"),
      value: gestationalAge,
      longForm: message("gestationalAgeFullText"),
    });
  if (postMenstrualAge)
    details.push({
      label: message("postMenstrualAge"),
      value: postMenstrualAge,
      longForm: message("postMenstrualAgeFullText"),
    });
  if (deceasedDate) details.push({ label: message("deceased"), value: deceasedDate });

  const PersonName = `h${personNameHeadingLevel}` as React.ElementType;

  return (
    <section
      className={"terra-demographics-banner" + (deceasedDate ? " is-deceased" : "")}
      aria-label="Patient demographics"
    >
      {photo ? <div className="profile-photo">{photo}</div> : null}
      <div className="content">
        <PersonName className="person-name">
          {personName}
          {preferredFirstName ? (
            <span className="preferred-first-name">{`(${preferredFirstName})`}</span>
          ) : null}
        </PersonName>
        <div className="identifier-row">
          <DetailList items={details} />
          <DetailList
            items={Object.entries(identifiers).map(([key, value]) => ({
              label: key,
              value,
              longForm: identifiersLongForm[key],
            }))}
          />
        </div>
        {applicationContent ? <div className="application-content">{applicationContent}</div> : null}
      </div>
    </section>
  );
};
