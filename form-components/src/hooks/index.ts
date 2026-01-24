/**
 * MOIS Hooks
 * All hooks for MOIS forms
 */

// Re-export core hooks from MoisContext
export {
  useSourceData,
  useActiveData,
  useSection,
  useCodeList,
  useOptionLists,
  useEffectOnce,
  useTheme,
  useButtonSize,
  useActivityOptions,
  useDataProfile,
} from '../context';

// Form state hooks
export {
  useActiveDataForForms,
  initFormData,
  setInitialData,
  getInitialData,
  getFormData,
  FormStateProvider,
} from './form-state';

// Mock hooks for form preview
export {
  useOnLoad,
  useOnRefresh,
  usePrinting,
  useMutation,
  useQuery,
  useFormLock,
  testLock,
  useHotKey,
  useMoisNavigate,
  useSetting,
  useTempData,
  useConfirmUnload,
} from './mock-hooks';
