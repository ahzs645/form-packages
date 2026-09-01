import React from "react";

/**
 * Patient banner mirroring Terra's demographics banner markup and tokens
 * (section > person-name + identifier-row of <dl> label/value pairs, values
 * bold). Terra's own React package targets React 16/17, so this reproduces
 * the presentation rather than depending on it.
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
  identifiers?: TerraBannerIdentifier[];
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
  identifiers = [],
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
        <DetailList items={identifiers} />
      </div>
      {applicationContent ? <div className="application-content">{applicationContent}</div> : null}
    </section>
  );
};
