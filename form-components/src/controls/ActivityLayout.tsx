/**
 * ActivityLayout Component
 * Wrapper for an activity form.
 *
 * The Activity control manages the page layout of activities in the MOIS client.
 * An "activity" is a set of views and actions designed to streamline a commonly
 * performed function for a specific user or class of users.
 */

import React from 'react';

/** Layout state prop type */
export interface LayoutStateProp {
  orientation?: 'landscape' | 'portrait' | 'auto';
  navSize?: string;
  detailSize?: string;
  nameBlockSize?: string;
}

export interface ActivityLayoutProps {
  /** Layout state and set state function */
  activityState?: LayoutStateProp;
  /** Contained controls: Activity.Ribbon, Activity.Navigation, Activity.Main, Activity.Detail */
  children: React.ReactNode;
  /** Style override */
  style?: React.CSSProperties;
}

// Sub-component props
interface RibbonProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  activityState?: LayoutStateProp;
}

interface NavigationProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  activityState?: LayoutStateProp;
}

interface NameBlockProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  activityState?: LayoutStateProp;
}

interface MainProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  activityState?: LayoutStateProp;
}

interface DetailProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  activityState?: LayoutStateProp;
}

// Ribbon sub-component
const Ribbon: React.FC<RibbonProps> = ({ children, style }) => {
  const ribbonStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    background: 'rgb(255, 255, 255)',
    borderWidth: '0px 0px 2px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'rgb(0, 120, 212)',
    borderTopStyle: 'initial',
    borderTopColor: 'initial',
    borderRightStyle: 'initial',
    borderRightColor: 'initial',
    borderLeftStyle: 'initial',
    borderLeftColor: 'initial',
    padding: '8px 16px',
    gridArea: 'ribbon',
    ...style,
  };

  return (
    <header className="activity-ribbon" style={ribbonStyles}>
      {children}
    </header>
  );
};

// Navigation sub-component
const Navigation: React.FC<NavigationProps> = ({ children, style }) => {
  const navStyles: React.CSSProperties = {
    background: 'rgb(239, 246, 252)',
    borderRight: '2px solid rgb(0, 24, 143)',
    padding: '8px',
    gridArea: 'nav',
    overflow: 'auto',
    ...style,
  };

  return (
    <nav className="activity-nav" style={navStyles}>
      {children}
    </nav>
  );
};

// NameBlock sub-component
const ActivityNameBlock: React.FC<NameBlockProps> = ({ children, style }) => {
  const nameBlockStyles: React.CSSProperties = {
    gridArea: 'nameBlock',
    ...style,
  };

  return (
    <div className="activity-nameBlock" style={nameBlockStyles}>
      {children}
    </div>
  );
};

// Main sub-component
const Main: React.FC<MainProps> = ({ children, style }) => {
  const mainStyles: React.CSSProperties = {
    padding: '16px',
    gridArea: 'main',
    overflow: 'auto',
    ...style,
  };

  return (
    <main className="activity-main" style={mainStyles}>
      {children}
    </main>
  );
};

// Detail sub-component
const Detail: React.FC<DetailProps> = ({ children, style }) => {
  const detailStyles: React.CSSProperties = {
    padding: '16px',
    gridArea: 'detail',
    overflow: 'auto',
    ...style,
  };

  return (
    <aside className="activity-detail" style={detailStyles}>
      {children}
    </aside>
  );
};

/**
 * ActivityLayout - Activity page layout wrapper
 *
 * Manages the page layout of activities with ribbon, navigation,
 * nameblock, main content, and detail panes.
 */
export const ActivityLayout: React.FC<ActivityLayoutProps> & {
  Ribbon: typeof Ribbon;
  Navigation: typeof Navigation;
  NameBlock: typeof ActivityNameBlock;
  Main: typeof Main;
  Detail: typeof Detail;
} = ({ activityState, children, style }) => {
  const orientation = activityState?.orientation || 'landscape';
  const navSize = activityState?.navSize || '200px';
  const detailSize = activityState?.detailSize || '300px';
  const nameBlockSize = activityState?.nameBlockSize || 'auto';

  // Check what children are present
  const childArray = React.Children.toArray(children);
  const hasNav = childArray.some((child: any) =>
    child?.type === Navigation || child?.type?.displayName === 'Navigation'
  );
  const hasDetail = childArray.some((child: any) =>
    child?.type === Detail || child?.type?.displayName === 'Detail'
  );
  const hasNameBlock = childArray.some((child: any) =>
    child?.type === ActivityNameBlock || child?.type?.displayName === 'NameBlock'
  );

  // Build grid template based on what's present
  // Navigation spans full height on left, Ribbon/NameBlock span only Main+Detail area
  let gridTemplateAreas: string;
  let gridTemplateColumns: string;
  let gridTemplateRows: string;

  if (hasNav && hasDetail && hasNameBlock) {
    // Landscape: Nav spans full height, Ribbon/NameBlock span main+detail columns
    gridTemplateAreas = `"nav ribbon ribbon" "nav nameBlock nameBlock" "nav main detail"`;
    gridTemplateColumns = `${navSize} 1fr ${detailSize}`;
    gridTemplateRows = `auto ${nameBlockSize} 1fr`;
  } else if (hasNav && hasDetail) {
    // Landscape without NameBlock
    gridTemplateAreas = `"nav ribbon ribbon" "nav main detail"`;
    gridTemplateColumns = `${navSize} 1fr ${detailSize}`;
    gridTemplateRows = `auto 1fr`;
  } else if (hasNav && hasNameBlock) {
    // Nav + NameBlock without Detail
    gridTemplateAreas = `"nav ribbon" "nav nameBlock" "nav main"`;
    gridTemplateColumns = `${navSize} 1fr`;
    gridTemplateRows = `auto ${nameBlockSize} 1fr`;
  } else if (hasDetail && hasNameBlock) {
    // No Nav: Ribbon/NameBlock span full width
    gridTemplateAreas = `"ribbon ribbon" "nameBlock nameBlock" "main detail"`;
    gridTemplateColumns = `1fr ${detailSize}`;
    gridTemplateRows = `auto ${nameBlockSize} 1fr`;
  } else if (hasNav) {
    // Just Nav + Main
    gridTemplateAreas = `"nav ribbon" "nav main"`;
    gridTemplateColumns = `${navSize} 1fr`;
    gridTemplateRows = `auto 1fr`;
  } else if (hasDetail) {
    // Just Detail + Main
    gridTemplateAreas = `"ribbon ribbon" "main detail"`;
    gridTemplateColumns = `1fr ${detailSize}`;
    gridTemplateRows = `auto 1fr`;
  } else if (hasNameBlock) {
    // Just NameBlock + Main
    gridTemplateAreas = `"ribbon" "nameBlock" "main"`;
    gridTemplateColumns = `1fr`;
    gridTemplateRows = `auto ${nameBlockSize} 1fr`;
  } else {
    // Minimal: just ribbon and main
    gridTemplateAreas = `"ribbon" "main"`;
    gridTemplateColumns = `1fr`;
    gridTemplateRows = `auto 1fr`;
  }

  const gridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateAreas,
    gridTemplateColumns,
    gridTemplateRows,
    height: '100%',
    minHeight: '400px',
    ...style,
  };

  return (
    <section className={`${orientation}Grid`} style={gridStyles}>
      {children}
    </section>
  );
};

// Attach sub-components
ActivityLayout.Ribbon = Ribbon;
ActivityLayout.Navigation = Navigation;
ActivityLayout.NameBlock = ActivityNameBlock;
ActivityLayout.Main = Main;
ActivityLayout.Detail = Detail;

// Create Activity object with Layout as a sub-component (for examples that use Activity.Layout)
export const Activity = {
  Layout: ActivityLayout,
  Ribbon,
  Navigation,
  NameBlock: ActivityNameBlock,
  Main,
  Detail,
};

export default ActivityLayout;
