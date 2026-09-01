import moment from "moment-timezone";

/**
 * Registers en-CA on the moment instance terra-date-picker actually uses.
 *
 * terra-date-picker's DateUtil derives the input mask, segment order and
 * separator from moment's locale data for `intl.locale`. moment bundles only
 * `en`, and looking up an unregistered locale falls back to it silently — so
 * an NH form renders US order, MM/DD/YYYY, instead of the YYYY-MM-DD used in
 * BC. That is a real hazard on a clinical form, where 05/06 is ambiguous.
 *
 * Importing `moment/locale/en-ca` does not work here. That file registers
 * against the moment it imports, and while pnpm resolves `moment` and
 * moment-timezone's `moment` to one package on disk, Vite pre-bundles CJS
 * dependencies per entry point and ends up with two module instances — the
 * registration lands on the copy Terra never reads. Importing
 * `moment-timezone`, exactly as DateUtil does, addresses the right instance
 * regardless of how the bundler splits things.
 *
 * Values are moment's own en-CA longDateFormat; everything else is inherited
 * from `en` via parentLocale.
 */
// Ask for the outcome we need rather than inspecting the registry: under Node
// moment lazily `require`s the real locale file on first use, and re-defining
// it there would be both redundant and a deprecation warning. Under a bundler
// that lazy require cannot resolve, the probe silently answers with `en`, and
// that is the case worth repairing.
const probe = moment();
probe.locale("en-CA");
if (probe.localeData().longDateFormat("L") !== "YYYY-MM-DD") {
  moment.defineLocale("en-ca", {
    parentLocale: "en",
    longDateFormat: {
      LT: "h:mm A",
      LTS: "h:mm:ss A",
      L: "YYYY-MM-DD",
      LL: "MMMM D, YYYY",
      LLL: "MMMM D, YYYY h:mm A",
      LLLL: "dddd, MMMM D, YYYY h:mm A",
    },
  });
  // defineLocale leaves the new locale active globally; Terra reads locale
  // data through explicit `.locale(tag)` calls, so restore the default.
  moment.locale("en");
}
