import React from "react";

/**
 * Stand-in for `react-onclickoutside`, which Terra's Hookshot uses to close
 * dropdowns and popups.
 *
 * The real package finds the wrapped component's DOM node with
 * `ReactDOM.findDOMNode`, which React 19 removed outright — importing it
 * throws at module scope. The public surface it exposes to Terra is small:
 * an HOC that calls `instance.handleClickOutside(event)` for document clicks
 * landing outside the wrapped node, plus `disableOnClickOutside` /
 * `enableOnClickOutside` props.
 *
 * Rather than `findDOMNode`, we read the element the wrapped class already
 * keeps on itself (Terra's `HookshotContent` assigns `this.contentNode` in its
 * ref callback), falling back to the first Element-valued own property.
 */

export interface OnClickOutsideProps {
  /** Suppress the listener without unmounting. */
  disableOnClickOutside?: boolean;
  /** Document events that count as an outside click. */
  eventTypes?: string | string[];
  /** Clicks inside an element carrying this class are ignored. */
  outsideClickIgnoreClass?: string;
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

interface OutsideClickHandler {
  handleClickOutside?(event: Event): void;
}

const DEFAULT_EVENTS = ["mousedown", "touchstart"];

function resolveNode(instance: unknown): Element | null {
  if (!instance || typeof instance !== "object") return null;
  const record = instance as Record<string, unknown>;
  if (record.contentNode instanceof Element) return record.contentNode;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (value instanceof Element) return value;
    if (value && typeof value === "object" && (value as { current?: unknown }).current instanceof Element) {
      return (value as { current: Element }).current;
    }
  }
  return null;
}

function isIgnored(target: Element, ignoreClass: string | undefined): boolean {
  if (!ignoreClass) return false;
  return target.closest(`.${ignoreClass}`) !== null;
}

export default function onClickOutside<P extends OnClickOutsideProps>(
  WrappedComponent: React.ComponentType<P>,
): React.ComponentType<P> {
  class OnClickOutside extends React.Component<P> {
    static displayName = `onClickOutside(${
      WrappedComponent.displayName || WrappedComponent.name || "Component"
    })`;

    private instance: OutsideClickHandler | null = null;

    private listening = false;

    componentDidMount(): void {
      if (!this.props.disableOnClickOutside) this.enable();
    }

    componentDidUpdate(prev: P): void {
      if (prev.disableOnClickOutside === this.props.disableOnClickOutside) return;
      if (this.props.disableOnClickOutside) this.disable();
      else this.enable();
    }

    componentWillUnmount(): void {
      this.disable();
    }

    private events(): string[] {
      const { eventTypes } = this.props;
      if (!eventTypes) return DEFAULT_EVENTS;
      return Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    }

    private setInstance = (node: OutsideClickHandler | null): void => {
      this.instance = node;
    };

    private handle = (event: Event): void => {
      const node = resolveNode(this.instance);
      const target = event.target;
      if (!node || !(target instanceof Element)) return;
      if (node.contains(target)) return;
      if (isIgnored(target, this.props.outsideClickIgnoreClass)) return;
      if (this.props.preventDefault) event.preventDefault();
      if (this.props.stopPropagation) event.stopPropagation();
      this.instance?.handleClickOutside?.(event);
    };

    private enable = (): void => {
      if (this.listening) return;
      for (const type of this.events()) document.addEventListener(type, this.handle, true);
      this.listening = true;
    };

    private disable = (): void => {
      if (!this.listening) return;
      for (const type of this.events()) document.removeEventListener(type, this.handle, true);
      this.listening = false;
    };

    render(): React.ReactNode {
      // Terra reads these two off props and deletes them before spreading onto
      // the DOM, matching react-onclickoutside's own injection.
      return React.createElement(WrappedComponent, {
        ...this.props,
        ref: this.setInstance,
        disableOnClickOutside: this.disable,
        enableOnClickOutside: this.enable,
      } as unknown as P);
    }
  }

  return OnClickOutside as unknown as React.ComponentType<P>;
}
