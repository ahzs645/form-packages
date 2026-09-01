# @webforms/cerner-core

Framework-free protocol layer for rendering webforms inside Cerner PowerChart
(MPages). Shared by every Cerner render tier: the Edge WebView2 player, the
IE11 launch-out shell, and the ES5 legacy mini-renderer.

This is a **clean-room implementation** of the MPage transport contract as
observed on the wire (XMLCclRequest blob transport, positional prompt strings,
Discern Web Services hex fallback). It contains no code from, and takes no
dependency on, Clinical Office: MPage Developer or any other vendor SDK.

## Modules

- `discern` — hosting constants: the `<meta name="discern">` capability tag
  PowerChart requires before it injects native bridges, no-cache meta tags,
  and the `$PAT_PersonId$` / `$VIS_EncntrId$` macro tokens.
- `environment` — host detection: `isInPowerChart` (the
  `"XMLCclRequest" in window.external` probe), `isLegacyInternetExplorer`
  (`document.documentMode`), and the render-tier decision.
- `envelope` — request/response types for a CCL entry script, the positional
  parameter-string builder, and `getCustomResult` for pulling custom-script
  output out of replies.
- `context` — chart-context resolution with the MPage component precedence:
  URL query params (`personId`/`encounterId`/`userId`) over host-element
  attributes (`person_id`/`encntr_id`/`prsnl_id`) over defaults.
- `hex` — byte-wise hex transcoding for the off-PowerChart POST path, plus
  `toAsciiJson` (escapes non-ASCII so payloads survive hex + control-char
  stripping) and `stripControlChars` for CCL replies.
- `transport` — `CclClient`: fixed slot pool with queueing (the slot index is
  part of the wire protocol), native `XMLCclRequest` inside PowerChart,
  hex-encoded POST to Discern Web Services (or a `/cclproxy` dev proxy)
  everywhere else.

## Runtime constraints

- Source targets modern TS, but runtime code avoids post-ES5 library APIs
  (no `Map`/`Set`/`findIndex`/`includes`) so the legacy bundle only needs a
  `Promise` polyfill.
- Payloads must be ASCII-safe on the wire; always serialize through
  `toAsciiJson` (the `CclClient` does this internally).
- CCL replies may contain raw control characters between spliced segments;
  the client strips `0x00–0x1F` before parsing, so multi-line text must
  arrive as JSON backslash escapes.
- The macro tokens are substituted by PowerChart itself and are meaningless
  over HTTP; `CclClient` only emits them on the in-PowerChart path.

## Server counterpart

The entry script this client speaks to lives in `packages/cerner-ccl`
(planned). Unlike the vendor contract we model this on, ours must whitelist
executable custom-script names and enforce person/encounter entitlement
server-side.
