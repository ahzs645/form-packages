import { describe, expect, it } from "vitest";

import {
  decodeAppLinkArguments,
  decodeClinicalNoteEvent,
  decodeMOEWFlags,
  decodeOrderStrings,
  decodeOrdersEvent,
  describeMOEWFlags,
  describeMPagesEvent,
  encodeAppLinkArguments,
  encodeClinicalNoteViewFlags,
  encodeMOEWFlags,
  encodeOrderString,
  encodeOrdersEvent,
  splitDiscernPayload,
} from "./discern-codes";

describe("order strings", () => {
  it("encodes each verb the way fluent-cerner-js does", () => {
    expect(encodeOrderString("launch moew")).toBe("{ORDER|0|0|0|0|0}");
    expect(encodeOrderString("new order", 32461245)).toBe("{ORDER|32461245|0|0|0|0}");
    expect(encodeOrderString("new order", 5, {
      origination: "satellite", orderSentenceId: 9, nomenclatureIds: [7, 8], interactionCheck: "on sign",
    })).toBe("{ORDER|5|5|9|[7|8]|1}");
    expect(encodeOrderString("cancel-discontinue", 44)).toBe("{CANCEL DC|44}");
    expect(encodeOrderString("renew prescription", 44)).toBe("{RENEW_RX|44}");
    expect(() => encodeOrderString("suspend")).toThrow("order id");
  });

  it("round-trips concatenated order strings, bracketed diagnoses included", () => {
    const field = encodeOrderString("new order", 5, { nomenclatureIds: [7, 8] }) + encodeOrderString("suspend", 44);
    expect(decodeOrderStrings(field)).toEqual([
      { verb: "ORDER", synonymId: 5, origination: "normal", orderSentenceId: 0, nomenclatureIds: [7, 8], interactionCheck: "default" },
      { verb: "SUSPEND", orderId: 44 },
    ]);
  });

  it("rejects what PowerChart would reject", () => {
    expect(() => decodeOrderStrings("{BOGUS|1}")).toThrow("not an ORDERS verb");
    expect(() => decodeOrderStrings("{ORDER|1|0}")).toThrow("five fields");
    expect(() => decodeOrderStrings("{CANCEL DC|0}")).toThrow("not an order id");
    expect(() => decodeOrderStrings("{ORDER|1|0|0|0|0}x")).toThrow("Unexpected");
    expect(() => decodeOrderStrings("{ORDER|1|0|0|0|0")).toThrow("Unbalanced");
  });
});

describe("the ORDERS event", () => {
  it("encodes and decodes tab, launch view, PowerPlan flag and silent signing", () => {
    const payload = encodeOrdersEvent({
      personId: 91294, encntrId: 123424,
      orders: [encodeOrderString("new order", 32461245), encodeOrderString("new order", 12341243)],
    });
    expect(payload).toBe("91294|123424|{ORDER|32461245|0|0|0|0}{ORDER|12341243|0|0|0|0}|0|{2|0}|32|0");
    const decoded = decodeOrdersEvent(payload);
    expect(decoded).toMatchObject({ personId: 91294, encntrId: 123424, tab: "orders", launchView: "signature", powerPlans: false, signSilently: false, launchOnly: false });
    expect(decoded.orders).toHaveLength(2);

    const meds = decodeOrdersEvent(encodeOrdersEvent({
      personId: 1, encntrId: 2, orders: [encodeOrderString("launch moew")], targetTab: "power medications", launchView: "search", signSilently: true,
    }));
    expect(meds).toMatchObject({ tab: "medications", display: 127, powerPlans: true, launchView: "search", signSilently: true, launchOnly: true });
  });

  it("describes the payload in words", () => {
    expect(describeMPagesEvent("ORDERS", "1|2|{ORDER|12345|0|0|0|0}|0|{2|0}|32|0"))
      .toBe("new order · synonym 12345 · Orders tab · opens on Signature");
    expect(describeMPagesEvent("ORDERS", "1|2|{CANCEL DC|9}|24|{3|127}|16|1"))
      .toBe("cancel/discontinue · order 9 · Medications tab with PowerPlans · opens on Profile · sign silently");
    expect(describeMPagesEvent("POWERFORM", "1|2|0|0|0")).toBe("open the PowerForm search (Ad Hoc)");
    /* the wiki: a POWERNOTE CKI names an encounter pathway, not a note template */
    expect(describeMPagesEvent("POWERNOTE", "1|2|CKI!X|0")).toBe("new note from encounter pathway CKI!X");
    expect(describeMPagesEvent("ORDERS", "1|2|{nope}|0|{2|0}|32|0")).toBeNull();
  });
});

describe("MOEW flags", () => {
  it("reproduces fluent-cerner-js' default bitmask and decodes it back", () => {
    const flags = encodeMOEWFlags("orders tab");
    /* 128 + 16 + 8 = 152; panes 1|2|4|8|16|32|64 = 127. fluent-cerner-js adds
       hide demographics (2048) and hide med rec (512) unless "show …" is
       passed, which is a caller policy, not part of the encoding. */
    expect(flags).toEqual({ dwCustomizeFlag: 152, dwTabFlag: 2, dwTabDisplayOptionsFlag: 127 });
    const decoded = decodeMOEWFlags({ ...flags, dwCustomizeFlag: flags.dwCustomizeFlag | 2048 | 512 | 1 << 20 });
    expect(decoded.tab).toBe("orders tab");
    expect(decoded.customize).toEqual(expect.arrayContaining(["hide demographics", "hide med rec", "allow power plans"]));
    expect(decoded.unknownCustomizeBits).toBe(1 << 20);
    expect(describeMOEWFlags(decodeMOEWFlags({ dwCustomizeFlag: 5, dwTabFlag: 3, dwTabDisplayOptionsFlag: 32 })))
      .toBe("medications tab · options: sign later, read only · panes: show scratchpad");
  });
});

describe("CLINICALNOTE and APPLINK", () => {
  it("decodes the bracketed event list and the view option bits", () => {
    const flags = encodeClinicalNoteViewFlags(["view-only", "toolbar"]);
    expect(flags).toBe(20);
    const event = decodeClinicalNoteEvent(`1|2|[301|302]|Two notes|${flags}||||`);
    expect(event).toMatchObject({ eventIds: [301, 302], windowTitle: "Two notes", viewOnly: true, viewFlags: ["toolbar", "view-only"] });
    expect(() => decodeClinicalNoteEvent("1|2|301|t|16||||")).toThrow("bracketed");
    expect(splitDiscernPayload("1|2|[3|4]|5")).toEqual(["1", "2", "[3|4]", "5"]);
  });

  it("round-trips APPLINK arguments with caret quoting and quick-open", () => {
    const args = encodeAppLinkArguments([
      { argument: "PERSONID", value: 1 },
      { argument: "FIRSTTAB", value: "Form Browser", quickOpen: true },
    ]);
    expect(args).toBe("/PERSONID=1 /FIRSTTAB=^Form Browser+^");
    expect(decodeAppLinkArguments(args)).toEqual({ PERSONID: "1", FIRSTTAB: "Form Browser+" });
    expect(encodeAppLinkArguments([{ argument: "organizertab", value: "Patient List", quickOpen: true }])).toBe("/ORGANIZERTAB=^Patient List^");
  });
});
