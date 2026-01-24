/**
 * @mois/form-components
 *
 * Complete MOIS UI components library for rendering web forms.
 * Includes controls, components, hooks, scope builders, and NHForms components.
 *
 * @example
 * ```typescript
 * import { buildScope, FormStateProvider, LivePreview } from '@mois/form-components';
 *
 * // Build the complete scope with all MOIS components
 * const scope = buildScope();
 *
 * // Render with state management
 * <FormStateProvider>
 *   <LivePreview code={formCode} />
 * </FormStateProvider>
 * ```
 */

// ============================================================================
// Controls
// ============================================================================
export {
  // Action controls
  Action,
  ActionDemo1,
  ActionDemo2,
  ActionDemo3,
  ActionBar,
  ActionButton,
  ActionRefresh,
  ActionEdit,
  ActionCheckMark,
  ActionAccept,
  ActionAdd,
  ActionCancel,
  ActionDelete,
  ActionInfo,
  ActionGotoRecord,
  ActionLinkToMois,
  // Activity
  Activity,
  ActivityLayout,
  // ButtonBar
  ButtonBar,
  ButtonBarDemo,
  // Column
  Column,
  Columns,
  ColumnDemo,
  // Date/Time
  DateSelect,
  DateSelectDemo1,
  DateSelectDemo2,
  DateSelectDemo3,
  DateSelectDemo4,
  DateSelectDemo5,
  DateTimeSelect,
  DateTimeSelectDemo,
  TimeSelect,
  TimeSelectDemo1,
  // FindCode
  FindCode,
  // FlowSheet
  FlowSheet,
  FlowSheetDemo,
  // Footer
  Footer,
  FooterDemo,
  // Grid
  Grid,
  GridItem,
  GridDemo1,
  GridDemo2,
  ControlGrid,
  // GuidelineLink
  GuidelineLink,
  // Header/Heading
  Header,
  HeaderDemo,
  Heading,
  // LayoutItem
  LayoutItem,
  LayoutItemDemo1,
  LayoutItemDemo2,
  LayoutItemDemo3,
  LayoutItemDemo4,
  ControlLayoutItem,
  // Linear
  Linear,
  LinearDemo,
  // ListSelection
  ListSelection,
  ListSelectionDemo1,
  ListSelectionDemo2,
  ListSelectionDemo3,
  ListSelectionDemo4,
  ListSelectionDemo5,
  ListSelectionDemo6,
  // Markdown
  Markdown,
  // Numeric
  Numeric,
  // ObjectLink
  ObjectLink,
  // OptionChoice
  OptionChoice,
  OptionChoiceDemo1,
  OptionChoiceDemo2,
  OptionChoiceDemo3,
  // Row
  Row,
  RowDemo1,
  RowDemo2,
  ControlRow,
  // SimpleCodeChecklist
  SimpleCodeChecklist,
  SimpleCodeChecklistDemo1,
  SimpleCodeChecklistDemo2,
  SimpleCodeChecklistDemo3,
  // SimpleCodeSelect
  SimpleCodeSelect,
  SimpleCodeSelectDemo1,
  SimpleCodeSelectDemo2,
  SimpleCodeSelectDemo3,
  SimpleCodeSelectDemo4,
  SimpleCodeSelectDemo5,
  SimpleCodeSelectDemo6,
  SimpleCodeSelectDemo7,
  SimpleCodeSelectDemo8,
  SimpleCodeSelectDemo9,
  // SubForm
  SubForm,
  SubFormDemo1,
  SubFormDemo2,
  SubFormDemo3,
  // SubTitle
  SubTitle,
  SubTitleGroupProvider,
  SubTitleButton,
  SubTitleButtonDemo1,
  // TextArea
  TextArea,
  TextAreaDemo1,
  TextAreaDemo2,
  TextAreaDemo3,
  TextAreaDemo4,
  TextAreaDemo5,
  TextAreaDemo6,
  TextAreaDemo7,
  // Title
  Title,
  TitleDemo1,
  // Watermark
  Watermark,
  WatermarkDemo1,
} from './controls';

// ============================================================================
// Components
// ============================================================================
export {
  // Layout components
  LayoutSection,
  SectionCompletionDemo,
  ArchFields,
  AuditStamp,
  // Section
  Section,
  // Form components
  BenefitPlans,
  CloseButton,
  Contact,
  DebugView,
  DeterminantsOfHealth,
  EncounterNotes,
  Form,
  FormCreationHistory,
  FormImage,
  FormVersion,
  HouseholdOccupant,
  Occupant,
  LinkToMois,
  MoisDialog,
  MoisDropdown,
  MoisTextField,
  NameBlock,
  Page,
  PageSelector,
  PageSelect,
  PageSelectContext,
  usePageSelect,
  PageStepButton,
  NextStepButton,
  BackStepButton,
  PageStepProvider,
  PrintButton,
  Provider,
  RefreshButton,
  SaveButton,
  SaveStatus,
  ServiceEpisode,
  SignButton,
  SubmitButton,
  Toast,
  useToast,
  UserProfile,
} from './components';

// ============================================================================
// Archetypes
// ============================================================================
export {
  AssociatedParty,
  ChartPreference,
  Connection,
  Correspondence,
  Encounter,
  Observation,
  ObservationPanel,
  Patient,
  Query,
  Task,
  Mois,
} from './archetypes';

// ============================================================================
// Dialogs
// ============================================================================
export {
  DeterminantsOfHealthEditDialog,
  EthnicityEditDialog,
  InsuranceEditDialog,
  TelecomEditDialog,
} from './dialogs';

// ============================================================================
// Context
// ============================================================================
export {
  // Contexts
  SourceDataContext,
  ActiveDataContext,
  SectionContext,
  // Providers
  MoisProvider,
  SectionProvider,
  DataProfileProvider,
  // Default data
  defaultSourceData,
  // Utility
  produce,
} from './context';

// ============================================================================
// Hooks
// ============================================================================
export {
  // Core hooks
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
  // Form state hooks
  useActiveDataForForms,
  initFormData,
  setInitialData,
  getInitialData,
  getFormData,
  FormStateProvider,
  // Mock hooks for form preview
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
} from './hooks';

// ============================================================================
// Scope
// ============================================================================
export {
  // Main scope builder
  buildScope,
  // Fluent UI namespace
  FluentNamespace,
  FluentActionButton,
  // MOIS namespaces
  MoisFunction,
  MoisHooks,
  MoisControl,
  MoisExtended,
  NameBlockFields,
  Pe,
  AihsControls,
  AihsActions,
  AihsFunctions,
  // Code transformer
  createComponentFromCode,
  // Live preview
  ErrorBoundary,
  LivePreview,
} from './scope';
export type { LivePreviewProps } from './scope';

// ============================================================================
// NHForms
// ============================================================================
export { nhformsComponents } from './nhforms';
