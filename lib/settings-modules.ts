import {
  Wallet,
  Target,
  CalendarClock,
  Tags,
  Zap,
  Users,
  MapPin,
  Files,
  Mail,
  Smartphone,
  User,
  ShieldCheck,
  SlidersHorizontal,
  Gauge,
  LifeBuoy,
} from 'lucide-react';
export const SETTINGS_MODULE_GROUPS = [
  {
    id: 'money',
    rows: [
      { id: 'accounts', href: '/accounts', icon: Wallet },
      { id: 'budgets', href: '/budgets', icon: Target },
      { id: 'planning', href: '/planning', icon: CalendarClock },
    ],
  },
  {
    id: 'organize',
    rows: [
      { id: 'categories', href: '/categories', icon: Tags },
      { id: 'automation', href: '/automation', icon: Zap },
      { id: 'contacts', href: '/contacts', icon: Users },
      { id: 'locations', href: '/locations', icon: MapPin },
    ],
  },
  {
    id: 'connections',
    rows: [
      { id: 'documents', href: '/settings?tab=documents', icon: Files },
      { id: 'email', href: '/settings?tab=email-forwarding', icon: Mail },
      { id: 'shortcuts', href: '/settings?tab=api-keys', icon: Smartphone },
    ],
  },
  {
    id: 'account',
    rows: [
      { id: 'profile', href: '/settings?tab=profile', icon: User },
      { id: 'security', href: '/settings?tab=security', icon: ShieldCheck },
      { id: 'preferences', href: '/settings?tab=preferences', icon: SlidersHorizontal },
    ],
  },
  {
    id: 'support',
    rows: [
      { id: 'plan', href: '/settings?tab=subscription', icon: Gauge },
      { id: 'help', href: '/settings?tab=help', icon: LifeBuoy },
    ],
  },
] as const;
