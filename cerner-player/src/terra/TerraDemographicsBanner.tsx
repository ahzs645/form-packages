import React from "react";

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

export interface TerraBannerIdentifier {
  label: string;
  value: string | number;
}

export interface TerraDemographicsBannerProps {
  personName: string;
  preferredFirstName?: string;
  age?: string;
  gender?: string;
  dateOfBirth?: string;
  deceasedDate?: string;
  /** Label → value, matching Terra's own DemographicsBanner prop shape. */
  identifiers?: Record<string, string>;
  applicationContent?: React.ReactNode;
}

const DetailList: React.FC<{ items: TerraBannerIdentifier[] }> = ({ items }) =>
  items.length === 0 ? null : (
    <dl>
      {items.map((item) => (
        <React.Fragment key={item.label}>
          <dt>{item.label}</dt>
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
  identifiers = {},
  applicationContent,
}) => {
  const details: TerraBannerIdentifier[] = [];
  if (age) details.push({ label: "Age", value: age });
  if (gender) details.push({ label: "Gender", value: gender });
  if (dateOfBirth) details.push({ label: "DOB", value: dateOfBirth });
  if (deceasedDate) details.push({ label: "Deceased", value: deceasedDate });

  return (
    <section
      className={"terra-demographics-banner" + (deceasedDate ? " is-deceased" : "")}
      aria-label="Patient demographics"
    >
      <h2 className="person-name">
        {personName}
        {preferredFirstName ? (
          <span className="preferred-first-name">{`(${preferredFirstName})`}</span>
        ) : null}
      </h2>
      <div className="identifier-row">
        <DetailList items={details} />
        <DetailList
          items={Object.entries(identifiers).map(([label, value]) => ({ label, value }))}
        />
      </div>
      {applicationContent ? <div className="application-content">{applicationContent}</div> : null}
    </section>
  );
};
