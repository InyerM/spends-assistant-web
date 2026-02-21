# Spends Assistant Web — Claude Rules

## CRITICAL PROJECT RULES

### NEVER create or use middleware.ts

**This is the #1 rule. Do NOT create `middleware.ts` or `middleware.js` at the project root, ever.**

The project uses `proxy.ts` for auth/session logic. It is NOT wired up as Next.js middleware and
must NOT be. Do not attempt to re-export it from `middleware.ts`. Do not create `middleware.ts` for
any reason. If you think you need middleware, ask the user first or use `proxy.ts`.

### Project Auth Pattern

- Auth redirects happen client-side via `useAuth()` hook and `proxy.ts` server-side utilities
- `proxy.ts` is used by API routes and server components, NOT as Next.js middleware
- Login redirect after successful auth: use `router.push('/dashboard')` in the login page

---

## Vercel React & Next.js Best Practices

All rules below MUST be followed when writing, reviewing, or refactoring code.

### 1. Eliminating Waterfalls — CRITICAL

**1.1 Defer Await Until Needed** Move `await` into branches where actually used. Don't block
early-return paths.

```ts
// BAD: blocks even when skipping
async function handle(id: string, skip: boolean) {
  const data = await fetch(id);
  if (skip) return { skipped: true };
  return process(data);
}
// GOOD: only await when needed
async function handle(id: string, skip: boolean) {
  if (skip) return { skipped: true };
  const data = await fetch(id);
  return process(data);
}
```

**1.2 Dependency-Based Parallelization** For partial dependencies, start independent promises
immediately. Use `Promise.all()` or `better-all`.

```ts
const userPromise = fetchUser();
const profilePromise = userPromise.then((u) => fetchProfile(u.id));
const [user, config, profile] = await Promise.all([userPromise, fetchConfig(), profilePromise]);
```

**1.3 Prevent Waterfall Chains in API Routes** Start independent operations immediately, await
later.

```ts
// GOOD
const sessionPromise = auth();
const configPromise = fetchConfig();
const session = await sessionPromise;
const [config, data] = await Promise.all([configPromise, fetchData(session.user.id)]);
```

**1.4 Promise.all() for Independent Operations**

```ts
// BAD: 3 round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();
// GOOD: 1 round trip
const [user, posts, comments] = await Promise.all([fetchUser(), fetchPosts(), fetchComments()]);
```

**1.5 Strategic Suspense Boundaries** Use `<Suspense>` to show wrapper UI faster. Move data fetching
into child async components. Don't block entire pages for one data source.

### 2. Bundle Size Optimization — CRITICAL

**2.1 Avoid Barrel File Imports** Import directly from source files, not barrel `index.ts` files.
Use `optimizePackageImports` in next.config for libraries like `lucide-react`.

```ts
// BAD
import { Check, X } from 'lucide-react'; // loads 1,583 modules
// GOOD (with next.config optimizePackageImports)
import { Check, X } from 'lucide-react'; // auto-transformed to direct imports
```

**2.2 Conditional Module Loading** Load large data/modules only when a feature is activated using
dynamic `import()`.

**2.3 Defer Non-Critical Third-Party Libraries** Analytics, logging, error tracking should load
after hydration using `next/dynamic` with `{ ssr: false }`.

**2.4 Dynamic Imports for Heavy Components** Use `next/dynamic` for large components not needed on
initial render (editors, charts, maps).

```ts
const MonacoEditor = dynamic(() => import('./monaco-editor').then((m) => m.MonacoEditor), {
  ssr: false,
});
```

**2.5 Preload Based on User Intent** Preload heavy bundles on hover/focus before they're needed.

```ts
const preload = () => { void import('./heavy-component') }
<button onMouseEnter={preload} onFocus={preload} onClick={onClick}>Open</button>
```

### 3. Server-Side Performance — HIGH

**3.1 Authenticate Server Actions Like API Routes** Server Actions are public endpoints. Always
verify auth INSIDE each action. Never rely solely on layout guards.

**3.2 Avoid Duplicate Serialization in RSC Props** Don't pass both original and transformed arrays
to client components. Send data once, transform in client.

```ts
// BAD: <ClientList usernames={names} sorted={names.toSorted()} />
// GOOD: <ClientList usernames={names} /> (sort in client)
```

**3.3 Cross-Request LRU Caching** Use `lru-cache` for data shared across requests. `React.cache()`
only works within one request.

**3.4 Minimize Serialization at RSC Boundaries** Only pass fields that the client actually uses, not
entire objects.

```ts
// BAD: <Profile user={user} /> (50 fields, uses 1)
// GOOD: <Profile name={user.name} />
```

**3.5 Parallel Data Fetching with Component Composition** Restructure RSC tree so sibling components
fetch in parallel, not sequentially.

**3.6 Per-Request Deduplication with React.cache()** Use `React.cache()` for DB queries, auth
checks, and heavy computations. Avoid inline objects as arguments (use same reference for cache
hits).

**3.7 Use after() for Non-Blocking Operations** Use Next.js `after()` to schedule logging,
analytics, cache invalidation after the response is sent.

### 4. Client-Side Data Fetching — MEDIUM-HIGH

**4.1 Deduplicate Global Event Listeners** Use shared listener patterns (e.g., `useSWRSubscription`)
so N component instances share 1 listener.

**4.2 Use Passive Event Listeners** Add `{ passive: true }` to touch/wheel event listeners that
don't call `preventDefault()`.

**4.3 Use SWR/React Query for Deduplication** Multiple component instances sharing the same query
key share one request. (This project uses React Query.)

**4.4 Version and Minimize localStorage Data** Add version prefix to keys. Store only needed fields.
Always wrap in try-catch.

### 5. Re-render Optimization — MEDIUM

**5.1 Derive State During Render** If a value can be computed from props/state, don't store it in
state or update in an effect.

```ts
// BAD: useEffect(() => { setFullName(first + ' ' + last) }, [first, last])
// GOOD: const fullName = first + ' ' + last
```

**5.2 Defer State Reads to Usage Point** Don't subscribe to state (searchParams, etc.) if you only
read it inside callbacks. Read on demand.

**5.3 Don't useMemo Simple Primitives** Simple boolean/number/string expressions don't need
`useMemo`. The hook overhead exceeds the computation.

**5.4 Hoist Default Non-Primitive Props** Extract default values for memoized component props to
constants to preserve memo.

```ts
const NOOP = () => {};
const Comp = memo(({ onClick = NOOP }) => { ... })
```

**5.5 Extract to Memoized Components** Extract expensive work into `memo()` components to enable
early returns before computation.

**5.6 Narrow Effect Dependencies** Use primitive values (`user.id`) not objects (`user`) in
dependency arrays.

**5.7 Put Interaction Logic in Event Handlers** Side effects triggered by user actions belong in
event handlers, not state + effect.

**5.8 Subscribe to Derived State** Subscribe to derived booleans
(`useMediaQuery('(max-width: 767px)')`) not continuous values (`useWindowWidth()`).

**5.9 Use Functional setState Updates** When updating state based on current state, use functional
form: `setItems(curr => [...curr, newItem])`.

**5.10 Use Lazy State Initialization** Pass a function to `useState` for expensive initial values:
`useState(() => buildIndex(items))`.

**5.11 Use Transitions for Non-Urgent Updates** Wrap frequent non-urgent state updates in
`startTransition()`.

**5.12 Use useRef for Transient Values** Mouse positions, intervals, transient flags — store in
`useRef`, not `useState`.

### 6. Rendering Performance — MEDIUM

**6.1 Animate SVG Wrapper** Wrap SVG in `<div>` and animate the div for hardware acceleration.

**6.2 CSS content-visibility for Long Lists** Use `content-visibility: auto` with
`contain-intrinsic-size` for off-screen items.

**6.3 Hoist Static JSX** Extract static JSX outside components to module scope to avoid re-creation.

**6.4 Optimize SVG Precision** Reduce SVG coordinate precision. Use `npx svgo --precision=1`.

**6.5 Prevent Hydration Mismatch Without Flickering** For client-only data (theme, preferences), use
inline `<script>` to set DOM before hydration.

**6.6 Suppress Expected Hydration Mismatches** Use `suppressHydrationWarning` for known differences
(dates, random IDs). Don't overuse.

**6.7 Use Activity Component for Show/Hide** Use React's `<Activity mode="visible"|"hidden">` to
preserve state/DOM for toggled components.

**6.8 Use Explicit Conditional Rendering** Use ternary `count > 0 ? <Badge /> : null` not
`count && <Badge />` (avoids rendering `0`).

**6.9 Use useTransition Over Manual Loading States** Prefer `useTransition` over manual `useState`
for loading states.

### 7. JavaScript Performance — LOW-MEDIUM

**7.1 Avoid Layout Thrashing** Don't interleave style writes with layout reads. Batch writes, then
read. Prefer CSS classes.

**7.2 Build Index Maps for Repeated Lookups** Multiple `.find()` calls by same key → build a `Map`
once, then `map.get()`.

**7.3 Cache Property Access in Loops** Cache deep property access (`obj.config.settings.value`)
before loops.

**7.4 Cache Repeated Function Calls** Use module-level `Map` to cache pure function results called
repeatedly with same inputs.

**7.5 Cache Storage API Calls** Cache `localStorage`/`sessionStorage` reads in a `Map`. Invalidate
on `storage` events.

**7.6 Combine Multiple Array Iterations** Multiple `.filter()` calls → single `for` loop populating
multiple arrays.

**7.7 Early Length Check for Array Comparisons** Check `arr1.length !== arr2.length` before
expensive deep comparisons.

**7.8 Early Return from Functions** Return early when result is determined. Don't continue
processing.

**7.9 Hoist RegExp Creation** Don't create `new RegExp()` inside render. Hoist to module scope or
`useMemo`.

**7.10 Use Loop for Min/Max** Single-pass loop is O(n). Don't sort O(n log n) just to find min/max.

**7.11 Use Set/Map for O(1) Lookups** Convert arrays to `Set`/`Map` for repeated membership checks.

**7.12 Use toSorted() for Immutability** Never `.sort()` React state/props. Use `.toSorted()` or
`[...arr].sort()`.

### 8. Advanced Patterns — LOW

**8.1 Initialize App Once** Don't put app-wide init in `useEffect([])`. Use module-level guard:
`let didInit = false`.

**8.2 Store Event Handlers in Refs** Use `useEffectEvent` or ref pattern for callbacks in effects
that shouldn't re-subscribe.

**8.3 useEffectEvent for Stable Callbacks** Access latest values in callbacks without adding them to
dependency arrays.

---

## Important

Before finishing a prompt, always check the code for any errors or typos.

- Run `pnpm typecheck` to check for any type errors.
- Run `pnpm lint:fix` to check for any linting errors.
- Run `pnpm format:fix` to format the code.
- Run `pnpm test:run` to ensure no test regressions.

---

## SOLID Principles (with project-specific examples)

**SRP — Single Responsibility Principle**

- A component should have ONE reason to change
- BAD: `transaction-form.tsx` (1125 lines) — mixes AI parsing, 3-step state machine, form
  validation, delete logic, and usage limit checks
- BAD: `categories/page.tsx` (832 lines) — embeds form schema, slug generation, tree filtering, and
  CRUD all in one page
- RULE: If a component does more than render UI + handle user events for ONE feature, extract the
  extra logic

**OCP — Open/Closed Principle**

- Prefer composition over conditionals. Use `children`, render props, or compound components
- BAD: A single component with 5 `if (step === 'x')` branches — extract each step into its own
  component

**LSP — Liskov Substitution**

- Extracted hooks must maintain the same contract as the inline logic they replace
- When extracting a hook from a component, the component's public props interface must not change

**ISP — Interface Segregation**

- Don't pass entire objects when a component only uses 1-2 fields (already in Vercel rules:
  server-serialization)
- BAD: `<Profile user={user} />` when only `user.name` is used
- GOOD: `<Profile name={user.name} />`

**DIP — Dependency Inversion**

- Components depend on hooks/abstractions, not on raw `fetch` or `supabase` calls
- BAD: `api-keys-tab.tsx` uses manual `useState`/`useEffect`/`fetch` instead of React Query
- BAD: `security-tab.tsx` calls `supabaseClient.auth` directly
- GOOD: All data fetching through `lib/api/queries/` + `lib/api/mutations/` + React Query hooks

---

## DRY — Don't Repeat Yourself

Known duplication patterns to avoid and refactor:

- **IntersectionObserver**: Use `hooks/use-infinite-scroll.ts` — never write inline
  IntersectionObserver
- **Search inputs**: Use `components/shared/search-input.tsx` for search + clear button pattern
- **Lookup helpers**: Use `lib/utils/lookup.ts` for `getAccountName()`, `findCategoryName()` etc.
- **CSV parsing**: Use `lib/utils/csv.ts` for `detectDelimiter()`, `parseCsvLine()`, `parseCsv()`
- **Form schemas**: Keep zod schemas in the component file ONLY if they're used nowhere else. If
  shared, move to `lib/schemas/`
- **Delete-then-toast**: The try/catch/toast pattern for mutations is handled by React Query
  `onSuccess`/`onError` callbacks — don't write manual try/catch

---

## STUPID — Avoid These Anti-Patterns

- **S**ingleton: Don't create global mutable state outside of Zustand stores
- **T**ight coupling: Components should not import from other components' internal files. Use the
  public API (hooks, shared components)
- **U**ntestable: If a function is hard to test, it's doing too much. Extract pure logic from React
  components
- **P**remature optimization: Don't `useMemo`/`useCallback` everything. Only memoize when profiling
  shows a need (already in Vercel rules: rerender-simple-expression-in-memo)
- **I**ndescriptive naming: Use descriptive names. `handleClick` is fine for a button, but
  `handleQuickCreateAndAnother` should be in a named hook
- **D**uplication: See DRY section above

---

## No Switch-Case — Use Object Mapping

**NEVER use `switch` or `switch/case` statements.** Use object/record mapping instead.

```ts
// BAD
switch (type) {
  case 'income':
    return 'green';
  case 'expense':
    return 'red';
  case 'transfer':
    return 'blue';
  default:
    return 'gray';
}

// GOOD
const TYPE_COLORS: Record<string, string> = {
  income: 'green',
  expense: 'red',
  transfer: 'blue',
};
const color = TYPE_COLORS[type] ?? 'gray';
```

Benefits: O(1) lookup, easier to extend, no fall-through bugs, testable as data.

If the mapping involves functions, use `Record<string, () => T>`:

```ts
const HANDLERS: Record<string, (ctx: Context) => Result> = {
  create: (ctx) => handleCreate(ctx),
  update: (ctx) => handleUpdate(ctx),
  delete: (ctx) => handleDelete(ctx),
};
const handler = HANDLERS[action];
if (handler) return handler(ctx);
```

---

## Component & Hook Guidelines

- **Max component size**: ~200 lines. If a component exceeds this, look for logic to extract into a
  custom hook or sub-component
- **Business logic location**: Custom hooks in `hooks/` for feature-specific logic (e.g.,
  `use-infinite-scroll.ts`, `use-csv-import.ts`). Pure utilities in `lib/utils/`
- **Data fetching**: ALWAYS through React Query (`lib/api/queries/` + `lib/api/mutations/`). Never
  raw `fetch` in components
- **State machines**: Multi-step flows (wizard, AI parse) should be managed by a custom hook that
  exposes `{ step, data, actions }`

### Clean Component Files — CRITICAL

**Component files (`.tsx` in `components/` and `app/`) must ONLY contain React components and their
directly coupled event handlers.** Everything else lives in a separate file:

| What                        | Where it goes                             | Example                               |
| --------------------------- | ----------------------------------------- | ------------------------------------- |
| Pure utility functions      | `lib/utils/<feature>.ts`                  | `parse24h`, `buildAutoMapping`        |
| Constants / config objects  | `lib/constants/<domain>.ts`               | `TRANSACTION_TYPES`, `SORT_OPTIONS`   |
| Types / interfaces (shared) | `types/`                                  | `TransactionFilters`, `AppField`      |
| Zod schemas (shared)        | `lib/schemas/`                            | Validation schemas used in >1 file    |
| Business logic hooks        | `hooks/`                                  | `useTransactionFilters`, `useAiParse` |
| Data fetching               | `lib/api/queries/` + `lib/api/mutations/` | React Query hooks                     |

**Rule of thumb:** If a function or constant does NOT use JSX or React hooks, it does NOT belong in
a component file. Move it to the appropriate `lib/` location and import it.

```ts
// BAD — utility function defined inside a component file
// components/transactions/import-dialog.tsx
function buildAutoMapping(headers: string[]) { ... }
const FIELD_CONFIGS = [ ... ];
export function ImportDialog() { ... }

// GOOD — utility extracted, component file only has the component
// lib/utils/csv-import.ts
export function buildAutoMapping(headers: string[]) { ... }
export const FIELD_CONFIGS = [ ... ];

// components/transactions/import-dialog.tsx
import { buildAutoMapping, FIELD_CONFIGS } from '@/lib/utils/csv-import';
export function ImportDialog() { ... }
```

Small private sub-components used only within the same file (e.g., a `ComparisonCard` inside a
dialog) are acceptable — they use JSX and are tightly coupled to the parent.

---

## Testing Requirements

- **New hooks**: Every extracted hook MUST have unit tests in `tests/hooks/`
- **New utils**: Every new utility file MUST have unit tests in `tests/lib/utils/`
- **TDD for refactoring**: When extracting existing logic:
  1. Write characterization tests for the logic
  2. Move the code to the new module
  3. Update imports
  4. Verify all tests pass
- **Run `pnpm test:run` before finishing** to ensure no regressions
