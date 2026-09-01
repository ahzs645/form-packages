import React from "react";

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

const DEFAULT_MESSAGES: Record<string, string> = {
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
};

export interface TerraIntl {
  formatMessage(descriptor: { id: string }, values?: Record<string, unknown>): string;
}

const IntlContext = React.createContext<Record<string, string>>(DEFAULT_MESSAGES);

export const TerraIntlProvider: React.FC<{
  messages?: Record<string, string>;
  children?: React.ReactNode;
}> = ({ messages, children }) => (
  <IntlContext.Provider value={{ ...DEFAULT_MESSAGES, ...messages }}>
    {children}
  </IntlContext.Provider>
);

function format(messages: Record<string, string>, id: string): string {
  return messages[id] ?? id;
}

export const FormattedMessage: React.FC<{
  id: string;
  children?: (formatted: string) => React.ReactNode;
}> = ({ id, children }) => {
  const messages = React.useContext(IntlContext);
  const text = format(messages, id);
  return <>{typeof children === "function" ? children(text) : text}</>;
};

/** Terra components receive `intl` as a prop; mirror that shape. */
export function injectIntl<P extends { intl?: TerraIntl }>(
  Component: React.ComponentType<P>,
): React.ComponentType<Omit<P, "intl">> {
  const Wrapped = (props: Omit<P, "intl">) => {
    const messages = React.useContext(IntlContext);
    const intl: TerraIntl = {
      formatMessage: (descriptor) => format(messages, descriptor.id),
    };
    return React.createElement(Component, { ...(props as P), intl });
  };
  Wrapped.displayName = `injectIntl(${Component.displayName || Component.name || "Component"})`;
  return Wrapped;
}

export const intlShape = {};
