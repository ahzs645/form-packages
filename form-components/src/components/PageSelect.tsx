/**
 * PageSelect Component
 * Navigation bar used to select a page. The number of Page components in
 * the form should match the number of pageNames here.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Icon, Link, Text, Breadcrumb, IBreadcrumbItem } from '@fluentui/react';

// Context for sharing selected page state between PageSelect and Page components
interface PageSelectContextValue {
  selectedPage: number;
  setSelectedPage: (page: number) => void;
}

export const PageSelectContext = createContext<PageSelectContextValue | null>(null);

// Global state for page selection (allows sibling components to share state)
let globalSelectedPage = 0;
let globalPageListeners: Array<() => void> = [];

const notifyPageListeners = () => {
  globalPageListeners.forEach(listener => listener());
};

export const getGlobalSelectedPage = () => globalSelectedPage;
export const setGlobalSelectedPage = (page: number) => {
  globalSelectedPage = page;
  notifyPageListeners();
};

// Reset page selection state (call when loading a new form)
export const resetPageSelection = () => {
  globalSelectedPage = 0;
  notifyPageListeners();
};

// Hook for components to subscribe to global page state
export const useGlobalPageSelect = () => {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  useEffect(() => {
    globalPageListeners.push(forceUpdate);
    return () => {
      globalPageListeners = globalPageListeners.filter(l => l !== forceUpdate);
    };
  }, []);

  return {
    selectedPage: globalSelectedPage,
    setSelectedPage: setGlobalSelectedPage,
  };
};

export const usePageSelect = () => {
  const context = useContext(PageSelectContext);
  const globalState = useGlobalPageSelect();

  // Prefer context if available, otherwise use global state
  return context || globalState;
};

export interface PageSelectProps {
  /** List of page names to show for selection */
  pageNames: string[];
  /** Default selected page index */
  defaultPage?: number;
  /** Callback when page changes */
  onPageChange?: (pageIndex: number) => void;
  /** Child Page components */
  children?: React.ReactNode;
}

const breadcrumbContainerStyle: React.CSSProperties = {
  background: 'rgb(255, 255, 255)',
  borderBottom: '1px solid rgb(237, 235, 233)',
  paddingBottom: '10px',
};

export const PageSelect: React.FC<PageSelectProps> = ({
  pageNames,
  defaultPage = 0,
  onPageChange,
  children,
}) => {
  // Subscribe to global page state so we update when PageStepButton changes pages
  const globalState = useGlobalPageSelect();
  const [selectedPage, setSelectedPageState] = useState(defaultPage);

  // Sync local state with global state (for when PageStepButton changes the page)
  useEffect(() => {
    if (globalState.selectedPage !== selectedPage) {
      setSelectedPageState(globalState.selectedPage);
    }
  }, [globalState.selectedPage]);

  // Initialize global state on mount
  useEffect(() => {
    setGlobalSelectedPage(defaultPage);
  }, []);

  const handlePageChange = (pageIndex: number) => {
    setSelectedPageState(pageIndex);
    setGlobalSelectedPage(pageIndex); // Also update global state for sibling components
    onPageChange?.(pageIndex);
  };

  const breadcrumbItems: IBreadcrumbItem[] = pageNames.map((name, index) => ({
    key: index.toString(),
    text: name,
    onClick: () => handlePageChange(index),
    isCurrentItem: index === selectedPage,
  }));

  const renderBreadcrumbItem = (item?: IBreadcrumbItem) => {
    if (!item) return null;
    return (
      <Link
        styles={{ root: { paddingLeft: '2em', paddingRight: '5px' } }}
        onClick={item.onClick}
      >
        <Icon iconName="CircleRing" styles={{ root: { paddingRight: '5px' } }} />
        <Text variant="large">
          {item.isCurrentItem ? <b>{item.text}</b> : <span>{item.text}</span>}
        </Text>
      </Link>
    );
  };

  // Demo mode when no pageNames provided or empty
  const displayItems = pageNames.length > 0
    ? breadcrumbItems
    : [
        { key: '0', text: 'first', onClick: () => handlePageChange(0), isCurrentItem: selectedPage === 0 },
        { key: '1', text: 'second', onClick: () => handlePageChange(1), isCurrentItem: selectedPage === 1 },
      ];

  const navigation = (
    <div id="breadcrumb" style={breadcrumbContainerStyle}>
      <div>
        <div style={{ position: 'relative' }}>
          <Breadcrumb
            items={displayItems}
            onRenderItem={renderBreadcrumbItem}
          />
        </div>
      </div>
    </div>
  );

  // If children are provided, wrap them with context
  if (children) {
    return (
      <PageSelectContext.Provider value={{ selectedPage, setSelectedPage: handlePageChange }}>
        {navigation}
        {children}
      </PageSelectContext.Provider>
    );
  }

  return navigation;
};

export default PageSelect;
