# Transaction Duplicate Detection

## Problem

Bank SMS messages forwarded via iOS Shortcuts can be sent twice (user error, shortcut
re-triggering). Users can also manually create transactions that overlap with SMS-created ones. We
need to detect and handle both cases.

## Detection Criteria

### Exact match (SMS re-triggers)

Same `raw_text` + same `source` → clearly a re-trigger.

### Near match (manual overlap)

Same `amount` + same `account_id` + same `date` (calendar day, America/Bogota timezone).

Exact check runs first. If it matches, near check is skipped.

## Behavior by Source

### SMS/Telegram/Email (automated)

- Create the transaction normally (all fields, automation rules applied)
- Set `duplicate_status = 'pending_review'` and `duplicate_of = matched_transaction.id`
- Transaction is fully functional (appears in totals, balances, reports)
- User reviews via badge on the transaction row

### Web/Web-AI (manual)

- Backend returns `409 Conflict` with the matching transaction data
- Frontend shows a duplicate warning dialog with side-by-side comparison
- Two options: "Create anyway" (keeps both) or "Replace existing" (swaps old for new)
- "Create anyway" → re-sends with `?force=true`, creates with `duplicate_status = 'confirmed'`
- "Replace existing" → sends with `?replace=<id>`, soft-deletes original, creates new with
  `duplicate_status = null`

## Database Changes

```sql
ALTER TABLE transactions ADD COLUMN duplicate_status TEXT DEFAULT NULL;
ALTER TABLE transactions ADD COLUMN duplicate_of UUID REFERENCES transactions(id) DEFAULT NULL;
CREATE INDEX idx_transactions_duplicate_status ON transactions (duplicate_status) WHERE duplicate_status IS NOT NULL;
```

Values for `duplicate_status`:

- `null` — normal transaction
- `'pending_review'` — flagged as possible duplicate (SMS flow)
- `'confirmed'` — user reviewed and chose "Keep both"

## UI

### Transaction row badge

- Transactions with `duplicate_status = 'pending_review'` show an amber `AlertTriangle` icon
- Tooltip: "Possible duplicate"

### Review flow (clicking flagged transaction)

- Opens transaction edit dialog with a banner at the top
- Shows compact summary of the matched transaction
- Actions: "Keep both" (sets `duplicate_status = 'confirmed'`) and "Delete this one" (soft-deletes)

### Duplicate warning dialog (web flow)

- Shown when `POST /api/transactions` returns 409
- Side-by-side comparison of existing vs new transaction
- Actions: "Create anyway" and "Replace existing"

### Filter

- Add filter option: "Show possible duplicates" → filters to `duplicate_status = 'pending_review'`

## Files to Change

### Database

- New migration: `20241125000007_add_duplicate_detection.sql`

### Backend (Cloudflare Worker)

- `src/services/supabase/transactions.service.ts` — update `findSimilarTransaction()`, add
  `findExactDuplicate()`
- `src/handlers/transaction.ts` — check for duplicates before creating
- `src/types/transaction.ts` — add `duplicate_status`, `duplicate_of` fields

### Frontend (Next.js)

- `types/transaction.ts` — add `duplicate_status`, `duplicate_of` fields
- `app/api/transactions/route.ts` — duplicate check before insert, 409 response, `force`/`replace`
  params
- `lib/api/mutations/transaction.mutations.ts` — handle 409 response
- `components/transactions/duplicate-warning-dialog.tsx` — NEW: side-by-side comparison dialog
- `components/transactions/transaction-list.tsx` — show duplicate badge
- `components/transactions/transaction-form.tsx` — show review banner for flagged transactions
- `lib/api/queries/transaction.queries.ts` — add duplicate filter option
