import moment from "moment-timezone";
import { describe, expect, it } from "vitest";

import "./moment-locale";
import { DEFAULT_MESSAGES } from "./intl";

/**
 * These assertions look trivial but guard a failure that is invisible at
 * runtime: moment answers an unregistered locale with `en` rather than
 * throwing, so a broken registration shows up only as US-ordered dates on a
 * BC form — where 05/06 is genuinely ambiguous.
 */
describe("en-CA registration", () => {
  it("registers en-CA on the instance terra-date-picker reads", () => {
    expect(moment.locales()).toContain("en-ca");
  });

  it("yields YYYY-MM-DD, which drives the picker's segment order", () => {
    const probe = moment();
    probe.locale("en-CA");
    expect(probe.localeData().longDateFormat("L")).toBe("YYYY-MM-DD");
  });

  it("leaves the global locale alone", () => {
    expect(moment.locale()).toBe("en");
  });

  it("keeps the date-format hint in step with the mask", () => {
    expect(DEFAULT_MESSAGES["Terra.datePicker.dateFormat"]).toBe("YYYY-MM-DD");
  });
});
