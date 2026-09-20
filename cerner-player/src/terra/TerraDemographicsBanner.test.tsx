// @vitest-environment happy-dom
//
// The reproduction is only useful while it stays interchangeable with the
// vendored Terra banner it stands in for, so these assert the prop surface as
// well as the markup.
import fs from "node:fs";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TerraDemographicsBanner } from "./TerraDemographicsBanner";

const VENDOR = "packages/cerner-terra/src/vendor/terra-demographics-banner/DemographicsBanner.jsx";
const WRAPPER = "packages/cerner-player/src/terra/TerraDemographicsBanner.tsx";

const render = (props: React.ComponentProps<typeof TerraDemographicsBanner>) =>
  renderToStaticMarkup(<TerraDemographicsBanner {...props} />);

describe("TerraDemographicsBanner prop surface", () => {
  it("accepts every prop the vendored Terra banner declares", () => {
    // Read from source rather than a hand-kept list: the vendored propTypes
    // move only when scripts/vendor.mjs re-runs, and that is exactly when this
    // should fail.
    const vendorProps = [
      ...fs.readFileSync(VENDOR, "utf8").matchAll(/^ {2}(\w+): PropTypes\./gm),
    ]
      .map((match) => match[1])
      // Supplied by injectIntl, not by the caller.
      .filter((name) => name !== "intl");
    const declared = fs
      .readFileSync(WRAPPER, "utf8")
      .match(/export interface TerraDemographicsBannerProps \{([\s\S]*?)\n\}/)?.[1];

    expect(vendorProps).toContain("identifiersLongForm");
    expect(declared).toBeTruthy();
    const ours = [...declared!.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]);
    expect(vendorProps.filter((name) => !ours.includes(name))).toEqual([]);
  });
});

describe("TerraDemographicsBanner rendering", () => {
  it("prints the person details in Terra's order", () => {
    const markup = render({
      personName: "ZZZTEST, HLS-NHGH-LTC",
      age: "46 Years",
      gender: "Male",
      dateOfBirth: "1980-01-01",
      gestationalAge: "34w 2d",
      postMenstrualAge: "38w 0d",
      deceasedDate: "2026-09-01",
    });
    const order = [...markup.matchAll(/<dd>([^<]+)<\/dd>/g)].map((match) => match[1]);
    expect(order).toEqual([
      "46 Years",
      "Male",
      "1980-01-01",
      "34w 2d",
      "38w 0d",
      "2026-09-01",
    ]);
    expect(markup).toContain("is-deceased");
  });

  it("labels gestational and post-menstrual age from Terra's own strings", () => {
    const markup = render({
      personName: "ZZZTEST, NEWBORN",
      gestationalAge: "34w 2d",
      postMenstrualAge: "38w 0d",
    });
    expect(markup).toContain('title="Gestational Age" aria-hidden="true">GA</abbr>');
    expect(markup).toContain('title="Post Menstrual Age" aria-hidden="true">PMA</abbr>');
    // The abbreviation is aria-hidden, so the full title has to be readable
    // some other way.
    expect(markup).toContain('<span class="visually-hidden-text">Gestational Age</span>');
    expect(markup).toContain('<span class="visually-hidden-text">Post Menstrual Age</span>');
  });

  it("expands abbreviated identifier labels, and leaves unlisted ones alone", () => {
    const markup = render({
      personName: "ZZZTEST, HLS-NHGH-LTC",
      identifiers: { "FIN NBR": "FIN-0001234", Encounter: "12345" },
      identifiersLongForm: { "FIN NBR": "Financial Number" },
    });
    expect(markup).toContain('<span class="visually-hidden-text">Financial Number</span>');
    expect(markup).toContain('title="Financial Number" aria-hidden="true">FIN NBR</abbr>');
    expect(markup).toContain("<dt>Encounter</dt>");
  });

  it("renders a photo, application content and a chosen heading level", () => {
    const markup = render({
      personName: "ZZZTEST, HLS-NHGH-LTC",
      preferredFirstName: "Mickey",
      photo: <img src="photo.png" alt="" />,
      applicationContent: <span>Allergies: Penicillins</span>,
      personNameHeadingLevel: 1,
    });
    expect(markup).toContain('<div class="profile-photo"><img src="photo.png" alt=""/></div>');
    expect(markup).toContain('<h1 class="person-name">');
    expect(markup).toContain('<span class="preferred-first-name">(Mickey)</span>');
    expect(markup).toContain('<div class="application-content"><span>Allergies: Penicillins</span></div>');
  });

  it("omits the photo slot and defaults the heading to Terra's level 2", () => {
    const markup = render({ personName: "ZZZTEST, HLS-NHGH-LTC" });
    expect(markup).not.toContain("profile-photo");
    expect(markup).toContain('<h2 class="person-name">');
  });
});
