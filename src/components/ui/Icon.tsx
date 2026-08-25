import {
  ArrowLeft,
  ArrowRight,
  Ban,
  BookOpen,
  Calculator,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Compass,
  Copy,
  Divide,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  FileText,
  FunctionSquare,
  Globe,
  GraduationCap,
  GripVertical,
  Hash,
  Info,
  Instagram,
  Layers,
  Lightbulb,
  LineChart,
  Linkedin,
  Loader2,
  LogOut,
  type LucideIcon,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Pencil,
  Percent,
  Phone,
  PieChart,
  Plus,
  Quote,
  RefreshCw,
  Ruler,
  Save,
  Search,
  Settings,
  Shield,
  Sigma,
  Sparkles,
  Star,
  Target,
  Trash2,
  Triangle,
  Trophy,
  Upload,
  Users,
  Variable,
  X,
  Youtube,
} from 'lucide-react';

/**
 * A named icon registry.
 *
 * Content in Firestore stores an icon as a *string* (`"triangle"`), because an admin
 * picking an icon in a form cannot store a React component. Mapping those strings here —
 * rather than importing all ~1,500 lucide icons dynamically — means the bundler only
 * ships the ones actually used, and an unrecognised name degrades to a sensible default
 * instead of crashing the section.
 */

export const ICONS = {
  // subjects & mathematics
  calculator: Calculator,
  divide: Divide,
  triangle: Triangle,
  sigma: Sigma,
  function: FunctionSquare,
  variable: Variable,
  ruler: Ruler,
  compass: Compass,
  percent: Percent,
  hash: Hash,
  circle: Circle,
  'pie-chart': PieChart,
  'line-chart': LineChart,
  book: BookOpen,
  graduation: GraduationCap,

  // selling points
  target: Target,
  trophy: Trophy,
  lightbulb: Lightbulb,
  calendar: Calendar,
  layers: Layers,
  sparkles: Sparkles,
  users: Users,
  shield: Shield,
  star: Star,
  clock: Clock,

  // contact & social
  phone: Phone,
  mail: Mail,
  'map-pin': MapPin,
  message: MessageCircle,
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  linkedin: Linkedin,
  globe: Globe,
  'external-link': ExternalLink,

  // interface
  check: Check,
  'check-circle': CheckCircle2,
  x: X,
  menu: Menu,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  info: Info,
  ban: Ban,
  spinner: Loader2,
  upload: Upload,
  trash: Trash2,
  plus: Plus,
  pencil: Pencil,
  grip: GripVertical,
  copy: Copy,
  download: Download,
  search: Search,
  eye: Eye,
  'eye-off': EyeOff,
  save: Save,
  refresh: RefreshCw,
  quote: Quote,

  // admin navigation
  dashboard: Calendar,
  'calendar-days': CalendarDays,
  'file-text': FileText,
  settings: Settings,
  logout: LogOut,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/** Names offered in the admin icon pickers, grouped for the dropdown. */
export const SUBJECT_ICON_NAMES: IconName[] = [
  'calculator',
  'divide',
  'triangle',
  'sigma',
  'function',
  'variable',
  'ruler',
  'compass',
  'percent',
  'hash',
  'circle',
  'pie-chart',
  'line-chart',
  'book',
  'graduation',
];

export const POINT_ICON_NAMES: IconName[] = [
  'target',
  'trophy',
  'lightbulb',
  'calendar',
  'layers',
  'sparkles',
  'users',
  'shield',
  'star',
  'clock',
  'check-circle',
  'book',
];

export const SOCIAL_ICON_NAMES: IconName[] = [
  'globe',
  'instagram',
  'youtube',
  'facebook',
  'linkedin',
  'mail',
  'phone',
  'message',
];

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Decorative by default; pass a label when the icon is the only content. */
  label?: string;
}

export function Icon({ name, size = 20, className, strokeWidth = 2, label }: IconProps) {
  const Component = (ICONS as Record<string, LucideIcon>)[name] ?? Calculator;
  return (
    <Component
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    />
  );
}
