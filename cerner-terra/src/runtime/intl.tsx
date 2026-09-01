import moment from "moment-timezone";

import "./moment-locale";

import React from "react";

import { hoistStatics } from "./hoist-statics";

/**
 * Minimal stand-in for the parts of `react-intl` Terra uses.
 *
 * Terra's intl surface is shallow — `FormattedMessage` for a handful of
 * literals (e.g. the "(optional)" suffix) and `injectIntl` to hand
 * components an `intl.formatMessage` for accessibility labels. Shimming it
 * removes the dependency entirely, which matters because Terra's peer range
 * (react-intl 2-5) tops out below React 18 and cannot be satisfied here.
 *
 * Translations default to Terra's own en-US strings; pass `messages` to
 * TerraIntlProvider to localise.
 */

/** moment's short date format (`L`) for a locale, e.g. "YYYY-MM-DD". */
function dateFormatForLocale(locale: string): string {
  const probe = moment();
  probe.locale(locale);
  return probe.localeData().longDateFormat("L");
}

/** Terra's own en strings, with the date hint derived below. */
export const DEFAULT_MESSAGES: Record<string, string> = {
  "Terra.form.field.optional": "(optional)",
  "Terra.form.field.hiddenRequired": "Required",
  "Terra.hyperlink.iconLabel.audio": "audio",
  "Terra.hyperlink.iconLabel.document": "document",
  "Terra.hyperlink.iconLabel.external": "external link",
  "Terra.hyperlink.iconLabel.image": "image",
  "Terra.hyperlink.iconLabel.video": "video",
  "Terra.alert.alert": "Alert",
  "Terra.alert.error": "Error",
  "Terra.alert.warning": "Warning",
  "Terra.alert.advisory": "Advisory",
  "Terra.alert.info": "Information",
  "Terra.alert.success": "Success",
  "Terra.alert.unsatisfied": "Unsatisfied",
  "Terra.alert.unverified": "Unverified",
  "Terra.demographicsBanner.deceased": "Deceased",
  "Terra.popup.header.close": "Close",
  "Terra.form.select.add": 'Add "{text}"',
  "Terra.form.select.defaultDisplay": "- Select -",
  "Terra.form.select.defaultComboboxDisplay": "Select or Enter",
  "Terra.form.select.noResults": 'No matching results for "{text}"',
  "Terra.form.select.resultsText": 'Results that contain "{text}"',
  "Terra.form.select.maxSelectionHelp": "Limit {text} items.",
  "Terra.form.select.maxSelectionOption": "Maximum number of {text} items selected",
  "Terra.form.select.ariaLabel": "Search",
  "Terra.form.select.selectedText": "{text} Selected. {index} of {totalOptions}.",
  "Terra.form.select.activeOption": "{text} {index} of {totalOptions}.",
  "Terra.form.select.of": "of",
  "Terra.form.select.unselectedText": "{text} Unselected.",
  "Terra.form.select.selected": "Selected.",
  "Terra.form.select.unselected": "Unselected.",
  "Terra.form.select.disabled": "Disabled.",
  "Terra.form.select.dimmed": "Dimmed.",
  "Terra.form.select.expanded": "Expanded combobox.",
  "Terra.form.select.collapsed": "Collapsed combobox.",
  "Terra.form.select.listOfTotalOptions": "List of options.",
  "Terra.form.select.defaultUsageGuidance":
    "Use up and down arrow keys to navigate through options. Press enter to select an option.",
  "Terra.form.select.mobileUsageGuidance": "Swipe right to navigate to options.",
  "Terra.form.select.mobileButtonUsageGuidance": "Tap to navigate to options.",
  "Terra.form.select.multiSelectUsageGuidance":
    "Enter text or use up and down arrow keys to navigate through options. Press enter to select or unselect an option.",
  "Terra.form.select.searchUsageGuidance":
    "Enter text or use up and down arrow keys to navigate through options. Press enter to select an option.",
  "Terra.form.select.clearSelect": "Clear select",
  "Terra.form.select.selectCleared": "Select value cleared",
  "Terra.form.select.menu": "Menu",
  "Terra.form.select.option": "Options",
  "Terra.form.select.optGroup": "Group {text}",
  "Terra.form.select.deselect": "Deselect {text}",
  "Terra.datePicker.disabled": "Disabled",
  "Terra.datePicker.openCalendar": "Open Calendar",
  "Terra.datePicker.closeCalendar": "Close",
  "Terra.datePicker.today": "Today",
  "Terra.datePicker.dayLabel": "Day",
  "Terra.datePicker.monthLabel": "Month",
  "Terra.datePicker.yearLabel": "Year",
  "Terra.datePicker.date": "Date",
  "Terra.datePicker.nextMonth": "Next month",
  "Terra.datePicker.previousMonth": "Previous month",
  "Terra.datePicker.calendarInstructions":
    "To change the selection, use the arrow keys. Press Enter to select a date. Press Escape to close the date picker pop-up.",
  "Terra.datePicker.dateFormatLabel": "Date Format:",
  "Terra.datePicker.invalidDate": "Please enter a valid Date",
  "Terra.datePicker.selected": "selected.",
  "Terra.datePicker.hotKey":
    "Press T to set current date, plus key for next date and minus key for previous date",
};

export interface TerraIntl {
  /** BCP 47 tag; the date picker reads it to pick a calendar locale. */
  locale: string;
  formatMessage(descriptor: { id: string }, values?: Record<string, unknown>): string;
}

interface IntlValue {
  locale: string;
  messages: Record<string, string>;
}

// terra-date-picker derives its input mask and placeholder from moment's
// locale data for `intl.locale`. moment bundles only `en`, and an unregistered
// locale falls back to it silently — which is why an unconfigured date field
// renders US order (MM/DD/YYYY) rather than the YYYY-MM-DD used in BC.
const DEFAULT_LOCALE = "en-CA";

/**
 * `Terra.datePicker.dateFormat` is the hint the date picker shows under the
 * field and reads out to screen readers. Terra ships it per-locale; we derive
 * it from moment so it cannot drift from the mask the picker actually renders,
 * which is computed from the same locale data.
 */
DEFAULT_MESSAGES["Terra.datePicker.dateFormat"] = dateFormatForLocale(DEFAULT_LOCALE);

const IntlContext = React.createContext<IntlValue>({
  locale: DEFAULT_LOCALE,
  messages: DEFAULT_MESSAGES,
});

export const TerraIntlProvider: React.FC<{
  locale?: string;
  messages?: Record<string, string>;
  children?: React.ReactNode;
}> = ({ locale, messages, children }) => {
  const value = React.useMemo(
    () => ({ locale: locale ?? DEFAULT_LOCALE, messages: { ...DEFAULT_MESSAGES, ...messages } }),
    [locale, messages],
  );
  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
};

/**
 * ICU messages in Terra's translations only ever use simple `{name}`
 * placeholders — no plural/select forms — so substitution is enough.
 */
function format(messages: Record<string, string>, id: string, values?: Record<string, unknown>): string {
  const template = messages[id] ?? id;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export const FormattedMessage: React.FC<{
  id: string;
  values?: Record<string, unknown>;
  children?: (formatted: string) => React.ReactNode;
}> = ({ id, values, children }) => {
  const { messages } = React.useContext(IntlContext);
  const text = format(messages, id, values);
  return <>{typeof children === "function" ? children(text) : text}</>;
};

/** Terra components receive `intl` as a prop; mirror that shape. */
export function injectIntl<P extends { intl?: TerraIntl }>(
  Component: React.ComponentType<P>,
): React.ComponentType<Omit<P, "intl">> {
  const Wrapped = (props: Omit<P, "intl">) => {
    const { locale, messages } = React.useContext(IntlContext);
    const intl: TerraIntl = React.useMemo(
      () => ({
        locale,
        formatMessage: (descriptor, values) => format(messages, descriptor.id, values),
      }),
      [locale, messages],
    );
    return React.createElement(Component, { ...(props as P), intl });
  };
  Wrapped.displayName = `injectIntl(${Component.displayName || Component.name || "Component"})`;
  // react-intl hoists non-React statics here; Terra relies on it for
  // `SingleSelect.Option` and friends.
  return hoistStatics(Wrapped, Component);
}

export const intlShape = {};
