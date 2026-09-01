# @webforms/cerner-terra-forms

The **Terra render target**: draws a builder document with Cerner Terra
components, the way PowerChart-era Northern Health screens look.

This is a peer of the MOIS and AlayaCare targets, not a replacement. The form
model in `@webforms/form-model` stays canonical; each target decides how to
draw it. Here that means `BuilderField` → a Terra control, with the same
`data-*` stamping the AlayaCare target uses so a coverage test can assert on
what actually rendered.

```tsx
import { TerraBase } from "@webforms/cerner-terra";
import { TerraFormRenderer } from "@webforms/cerner-terra-forms";

<TerraBase>
  <TerraFormRenderer fields={fields} />
</TerraBase>
```

`<TerraBase>` is not optional — see [Why TerraBase is required](#why-terrabase-is-required).

## Control mapping

`resolveTerraControl(field)` picks a control in this order:

1. an explicit `terraConfig.control` override on the field,
2. for `choice` fields, the choice style (radio / checkbox / dropdown /
   searchable dropdown),
3. otherwise the field type.

| Control | Terra component | Notes |
|---|---|---|
| `text`, `number` | `Input` | `email` → `type=email`, `phone` → `type=tel` |
| `textarea` | `Textarea` | rows from `textareaConfig` |
| `date` | `DatePicker` | segmented Y/M/D input plus calendar popup |
| `datetime`, `time` | `Input` | **native** — see below |
| `checkbox` | `Checkbox` | label hidden; the `Field` supplies it |
| `radio-group` | `Radio` × n | also backs `booleanYesNo` |
| `checkbox-group` | `Checkbox` × n | multi-select choice |
| `select` | `Select` | portal dropdown via Hookshot |
| `select-search` | `SearchSelect` | typeahead |
| `table` | `terra-html-table` | `paddingStyle="compact"`; cells typed per column |
| `section`, `heading` | `Heading` | level 2 / 3 |
| `hyperlink` | `Hyperlink` | |
| `rich-text` | `react-markdown` + `remark-gfm` | matches what the MOIS target does through `RichMarkdownBlock` |
| `computed-display` | `<output>` | |
| `component-placeholder` | — | names the MOIS component and says there is no Terra equivalent |

Anything unmapped renders a stamped `unsupported` node carrying the reason,
rather than being dropped. `getTerraCompatibilityReport(fields)` returns the
same information ahead of render, which is what the player's banner shows.

### Why some controls are native

terra-form-input carries an explicit allowlist — `text`, `number`,
`password`, `email`, `search`, `tel`, `url`, `hidden`. For anything else it
renders a bare `<input>` **with no Terra class at all**, because Terra expects
a dedicated picker component instead. We have real Terra components for date
and select, so what is left native is `time`, `datetime-local`, and the
`<select>` a table's choice column uses. `terra-fallbacks.css` styles exactly
those, matched on the input's own `type`.

Do not widen those selectors to `data-terra-control`. A control-kind selector
also matches the Terra components now backing date, select and select-search,
and draws a second border inside their own chrome.

## Why TerraBase is required

Terra authors every dimension in `rem`, and `terra-base` is what makes those
resolve: it sets `font-size: 87.5%` on `html`, giving the **14px root** the
whole scale assumes. It is also where `box-sizing: border-box` is normalised
and where `dir` is stamped — Terra scopes much of its CSS under `[dir=ltr]`.

Without it nothing errors; it just renders subtly wrong everywhere. Measured
on this package's own showcase before `<TerraBase>` existed:

| | without | with | Terra spec |
|---|---|---|---|
| input font-size | 18.29px | 16px | 16px |
| input height | 34.28px | 30px | 30px |
| input padding | 4.57px | 4px | 4px |
| input box-sizing | `content-box` | `border-box` | `border-box` |
| label font-size | 16px | 14px | 14px |

Every value is 16/14 = 1.143× too large, because `rem` resolved against the
browser's default 16px root instead of Terra's 14px one.

`rem` resolves against the root element, so this cannot be scoped to a
container — `<TerraBase>` has to touch `<html>`. It therefore adds a
`terra-base` class only while mounted (reference-counted, so nesting is
safe), and the generated stylesheet is scoped to `html.terra-base`. That
keeps it off the player's MOIS/Fluent path, which shares the document.

**Component-slot caveat.** In a Cerner Workflow *component* the page belongs
to the host, and the reference MPages are emphatic that global CSS is
radioactive — the vendor template's `styles.scss` is a one-line warning not
to define any. Mounting `<TerraBase>` there restyles the host page. A
full-page MPage, which is what a form is, owns its document and is fine.
Embedding in a component slot needs either a host that already applies
terra-base, or a rem→em pass over the vendored SCSS.

## Testing

`TerraFormRenderer.test.tsx` renders a 30-field fixture covering every
control the mapping resolves and asserts each one appears. Two cases guard
failures that are invisible at runtime rather than merely wrong:

- **table header `scope`** — Terra derives it from `child.type.name`, so a
  wrapper that renames components silently drops it;
- **date format** (in `@webforms/cerner-terra`) — moment answers an
  unregistered locale with `en` instead of throwing, so a broken registration
  surfaces only as US-ordered dates on a BC form.

## Showcase

`packages/cerner-player/docs/terra-showcase.png` and `.html`, regenerated by
`scripts/snapshot-terra-showcase.mjs` against the running player.

## Known gaps

- `terraConfig` lives on the field as a loose override; it has not been
  hoisted into the form model schema.
- Layout tables are not supported — the Terra table renders data rows only.
- `Combobox` and `MultiSelect` are exported by the fork but not wired here.
- Field widths lay out with `inline-block` fractions, not a grid.
- No submit/validation chrome: this renders a form, it does not run one.
