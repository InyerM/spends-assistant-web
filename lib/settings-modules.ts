export const SETTINGS_MODULE_GROUPS = [
  {
    id: 'money',
    rows: [
      { id: 'accounts', href: '/accounts' },
      { id: 'budgets', href: '/budgets' },
      { id: 'planning', href: '/planning' },
    ],
  },
  {
    id: 'organize',
    rows: [
      { id: 'categories', href: '/categories' },
      { id: 'automation', href: '/automation' },
      { id: 'contacts', href: '/contacts' },
      { id: 'locations', href: '/locations' },
    ],
  },
  {
    id: 'connections',
    rows: [
      { id: 'documents', href: '/settings?tab=documents' },
      { id: 'email', href: '/settings?tab=email-forwarding' },
      { id: 'shortcuts', href: '/settings?tab=api-keys' },
    ],
  },
  {
    id: 'account',
    rows: [
      { id: 'profile', href: '/settings?tab=profile' },
      { id: 'security', href: '/settings?tab=security' },
      { id: 'preferences', href: '/settings?tab=preferences' },
    ],
  },
  {
    id: 'support',
    rows: [
      { id: 'plan', href: '/settings?tab=subscription' },
      { id: 'help', href: '/settings?tab=help' },
    ],
  },
] as const;
