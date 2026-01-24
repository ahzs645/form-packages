/**
 * PageStepButton Component
 * Button to step to the next or previous form page. NextStepButton and
 * BackStepButton are aliases for this control.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { DefaultButton } from '@fluentui/react';
import { useButtonSize, ButtonSize } from '../context/MoisContext';
import { usePageSelect } from '../components/PageSelect';

/** Context for sharing page state between PageStepButtons */
interface PageStepContextType {
  currentPage: number;
  setCurrentPage: (page: number) => void;
}

const PageStepContext = createContext<PageStepContextType | null>(null);

/** Provider to wrap PageStepButtons that need to share state */
export interface PageStepProviderProps {
  children: React.ReactNode;
  /** Initial page (0-indexed). Default is 0 */
  initialPage?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
}

export const PageStepProvider: React.FC<PageStepProviderProps> = ({
  children,
  initialPage = 0,
  onPageChange,
}) => {
  const [currentPage, setCurrentPageState] = useState(initialPage);

  const setCurrentPage = useCallback((page: number) => {
    setCurrentPageState(page);
    onPageChange?.(page);
  }, [onPageChange]);

  return (
    <PageStepContext.Provider value={{ currentPage, setCurrentPage }}>
      {children}
    </PageStepContext.Provider>
  );
};

export interface PageStepButtonProps {
  /** Step to previous page instead of next page */
  back?: boolean;
  /** Current page index (0-indexed). If not provided, uses context or internal state */
  currentPage?: number;
  /** Button disabled override */
  disabled?: boolean;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
  /** Total number of pages (1-indexed count). E.g., pages={5} means pages 0-4 */
  pages?: number;
  /** Button size (min, tiny, small, medium, large, max) */
  size?: ButtonSize;
  /** Button text override from default */
  text?: string;
}

/**
 * PageStepButton - Navigate between form pages
 *
 * Use this button to step forward or backward through multi-page forms.
 * The back button is automatically disabled on the first page,
 * and the next button is disabled on the last page.
 */
export const PageStepButton: React.FC<PageStepButtonProps> = ({
  back = false,
  currentPage: controlledPage,
  disabled: disabledOverride,
  onPageChange,
  pages = 1,
  size = 'small',
  text,
}) => {
  // Try to get shared state from PageStepContext (local to this component family)
  const pageStepContext = useContext(PageStepContext);

  // Also try to get state from PageSelect's global page state
  const pageSelectState = usePageSelect();

  // Internal state for standalone usage (no context, no controlled props)
  const [internalPage, setInternalPage] = useState(0);

  // Determine current page: controlled prop > PageStepContext > PageSelect > internal state
  const currentPage = controlledPage
    ?? pageStepContext?.currentPage
    ?? pageSelectState?.selectedPage
    ?? internalPage;

  // Determine how to update page
  const setCurrentPage = useCallback((newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    } else if (pageStepContext) {
      pageStepContext.setCurrentPage(newPage);
    } else if (pageSelectState) {
      // Use PageSelect's global state to change pages
      pageSelectState.setSelectedPage(newPage);
    } else {
      setInternalPage(newPage);
    }
  }, [onPageChange, pageStepContext, pageSelectState]);

  // Default text based on direction
  const buttonText = text || (back ? 'Previous step' : 'Next step');

  // Get theme-based button styles (centralized)
  const buttonStyles = useButtonSize(size);

  // Calculate if button should be disabled based on page position
  const lastPageIndex = Math.max(0, pages - 1);
  const isFirstPage = currentPage <= 0;
  const isLastPage = currentPage >= lastPageIndex;

  // Disable back button on first page, next button on last page
  const autoDisabled = back ? isFirstPage : isLastPage;
  const isDisabled = disabledOverride ?? autoDisabled;

  const handleClick = () => {
    if (back) {
      setCurrentPage(Math.max(0, currentPage - 1));
    } else {
      setCurrentPage(Math.min(lastPageIndex, currentPage + 1));
    }
  };

  return (
    <DefaultButton
      text={buttonText}
      disabled={isDisabled}
      onClick={handleClick}
      styles={buttonStyles}
    />
  );
};

// Aliases for convenience
export const NextStepButton: React.FC<Omit<PageStepButtonProps, 'back'>> = (props) => (
  <PageStepButton {...props} back={false} />
);

export const BackStepButton: React.FC<Omit<PageStepButtonProps, 'back'>> = (props) => (
  <PageStepButton {...props} back={true} />
);

export default PageStepButton;
