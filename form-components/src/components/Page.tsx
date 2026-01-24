/**
 * Page Component
 * Wrapper for page contents. Pages are selected similar to tabs using the
 * PageSelector control.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Stack, Icon, Link, Text, Breadcrumb, IBreadcrumbItem } from '@fluentui/react';
import { usePageSelect } from './PageSelect';

// Page context for managing active page
interface PageContextValue {
  activePage: number;
  setActivePage: (page: number) => void;
  pages: { id: number; label: string }[];
  registerPage: (id: number, label: string) => void;
}

const PageContext = createContext<PageContextValue | null>(null);

export interface PageProps {
  /** Page contents */
  children: ReactNode;
  /** Override wrapping Linear layout props */
  linearLayoutProps?: any;
  /** Page number */
  pageId?: number;
  /** Page label for breadcrumb */
  label?: string;
}

export interface PageSelectorProps {
  /** Child Page components */
  children: ReactNode;
  /** Default active page */
  defaultPage?: number;
  /** Callback when page changes */
  onPageChange?: (pageId: number) => void;
}

// Container styles
const containerStyle: React.CSSProperties = {
  maxWidth: '950px',
  margin: 'auto',
  paddingTop: 0,
  paddingBottom: 0,
};

const breadcrumbContainerStyle: React.CSSProperties = {
  background: 'rgb(255, 255, 255)',
  borderBottom: '1px solid rgb(237, 235, 233)',
  paddingBottom: '10px',
};

// PageSelector - manages multiple pages with breadcrumb navigation
export const PageSelector: React.FC<PageSelectorProps> = ({
  children,
  defaultPage = 0,
  onPageChange,
}) => {
  const [activePage, setActivePage] = useState(defaultPage);
  const [pages, setPages] = useState<{ id: number; label: string }[]>([]);

  const registerPage = (id: number, label: string) => {
    setPages(prev => {
      if (prev.find(p => p.id === id)) return prev;
      return [...prev, { id, label }].sort((a, b) => a.id - b.id);
    });
  };

  const handlePageChange = (pageId: number) => {
    setActivePage(pageId);
    onPageChange?.(pageId);
  };

  const breadcrumbItems: IBreadcrumbItem[] = pages.map(page => ({
    key: page.id.toString(),
    text: page.label,
    onClick: () => handlePageChange(page.id),
    isCurrentItem: page.id === activePage,
  }));

  const renderBreadcrumbItem = (item?: IBreadcrumbItem): JSX.Element | null => {
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

  return (
    <PageContext.Provider value={{ activePage, setActivePage: handlePageChange, pages, registerPage }}>
      <div>
        <Stack style={containerStyle}>
          {/* Breadcrumb navigation */}
          {pages.length > 1 && (
            <div id="breadcrumb" style={breadcrumbContainerStyle}>
              <Breadcrumb
                items={breadcrumbItems}
                onRenderItem={renderBreadcrumbItem}
              />
            </div>
          )}
          {/* Render children (Page components) */}
          {children}
        </Stack>
      </div>
    </PageContext.Provider>
  );
};

// Demo content for standalone Page preview
const DemoPageContent: React.FC = () => {
  const [activePage, setActivePage] = useState(1);

  const breadcrumbItems: IBreadcrumbItem[] = [
    { key: '0', text: 'first', onClick: () => setActivePage(0), isCurrentItem: activePage === 0 },
    { key: '1', text: 'second', onClick: () => setActivePage(1), isCurrentItem: activePage === 1 },
  ];

  const renderBreadcrumbItem = (item?: IBreadcrumbItem): JSX.Element | null => {
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

  return (
    <div>
      <Stack style={containerStyle}>
        {/* Breadcrumb navigation */}
        <div id="breadcrumb" style={breadcrumbContainerStyle}>
          <Breadcrumb
            items={breadcrumbItems}
            onRenderItem={renderBreadcrumbItem}
          />
        </div>
        {/* Page content */}
        <div>
          <Stack style={containerStyle}>
            <div style={{ breakInside: 'avoid', margin: '8px 0' }}>
              <label className="ms-Label" style={{ display: 'block', fontWeight: 600, padding: '5px 0' }}>
                A control on the {activePage === 0 ? 'first' : 'second'} page
              </label>
              <div style={{ display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
                <div style={{ flex: '2 1 0%', display: 'flex', flexFlow: 'wrap', minWidth: '160px' }}>
                  <input
                    type="text"
                    style={{
                      padding: '6px 8px',
                      border: '1px solid #8a8886',
                      borderRadius: '2px',
                      minWidth: '200px',
                      outline: 'none',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>
            </div>
          </Stack>
        </div>
      </Stack>
    </div>
  );
};

// Page component
export const Page: React.FC<PageProps> = ({
  children,
  linearLayoutProps,
  pageId = 0,
  label = `Page ${pageId + 1}`,
}) => {
  const context = useContext(PageContext);
  const pageSelectContext = usePageSelect();

  // Register this page when mounted (for PageSelector context)
  React.useEffect(() => {
    context?.registerPage(pageId, label);
  }, [pageId, label]);

  // If no context and no children, show demo
  if (!context && !pageSelectContext && !children) {
    return <DemoPageContent />;
  }

  // Check PageSelectContext first (from PageSelect component)
  if (pageSelectContext) {
    // Only render if this is the selected page
    if (pageSelectContext.selectedPage !== pageId) {
      return null;
    }
    return (
      <div>
        <Stack style={containerStyle} {...linearLayoutProps}>
          {children}
        </Stack>
      </div>
    );
  }

  // If no context, render standalone with children
  if (!context) {
    return (
      <div>
        <Stack style={containerStyle} {...linearLayoutProps}>
          {children}
        </Stack>
      </div>
    );
  }

  // Only render if this is the active page (PageSelector context)
  if (context.activePage !== pageId) {
    return null;
  }

  return (
    <div>
      <Stack style={containerStyle} {...linearLayoutProps}>
        {children}
      </Stack>
    </div>
  );
};

export default Page;
