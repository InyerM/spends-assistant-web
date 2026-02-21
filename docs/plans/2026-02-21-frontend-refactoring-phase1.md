# Frontend Refactoring Phase 1 — Extract by Impact

**Date:** 2026-02-21 **Approach:** TDD characterization tests → extract → verify green
**Principle:** No breaking changes — interfaces stay the same

## Extractions

### 1. `useInfiniteScroll` hook

**From:** `transaction-list.tsx` (lines 153-169), `automation/page.tsx` (lines 93-109) **To:**
`hooks/use-infinite-scroll.ts` **Why:** Exact duplicate IntersectionObserver boilerplate in 2
places.

### 2. CSV utilities

**From:** `import-dialog.tsx` (lines 89-140): `detectDelimiter()`, `parseCsvLine()`, `parseCsv()`
**To:** `lib/utils/csv.ts` **Why:** Pure functions embedded in a 711-line component. Zero coupling
to React.

### 3. Lookup helpers

**From:** `transaction-form.tsx`, `automation/page.tsx`, `transaction-list.tsx` **To:**
`lib/utils/lookup.ts` **Why:** `getAccountName()`, `findCategoryName()` duplicated 3x with minor
variations.

### 4. SearchInput shared component

**From:** `accounts/page.tsx`, `categories/page.tsx`, `automation/page.tsx`,
`transaction-filters.tsx` **To:** `components/shared/search-input.tsx` **Why:** Same search + clear
button pattern repeated 4x (some pages have it twice for responsive).

## TDD Approach

Since we're extracting existing logic (not creating new):

1. Write characterization tests for the logic in its new location
2. Move the code to the new module
3. Update imports in the original files
4. Verify all tests pass (new + existing)

## Success Criteria

- All existing tests pass
- New unit tests for each extraction
- No component interface changes
- `pnpm typecheck && pnpm lint:fix && pnpm format:fix` clean
