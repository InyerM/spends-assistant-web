# iOS Messages to the Shortcut inbox

Checked against Apple's Shortcuts and Messages documentation on 2026-09-29. This is a setup guide
for the existing [inbox contract](../shortcut-inbox-contract.md), not an installable Shortcut.
Validate the actions on the intended iPhone and iOS version with synthetic messages before enabling
a real sender. No historical messages or production transactions were imported while preparing this
guide.

## Why there is no `.shortcut` file in this repository

On this macOS 27 machine, `/usr/bin/shortcuts` offers `run`, `list`, `view`, and `sign`; its manual
says to use the Shortcuts app to **create or edit** a shortcut. The CLI does not offer a supported
file-generation command.
[Apple's Mac creation guide](https://support.apple.com/en-au/guide/shortcuts-mac/apd84c576f8c/mac)
also builds actions in the app. A hand-written workflow plist would be an unverified artifact.

Apple documents two file export audiences. **Anyone** sends a copy to Apple for validation; **People
Who Know Me** is locally signed but includes the creator's contact information and is restricted to
eligible recipients. Neither produces a validated, anonymous, generally installable file under this
task's no-iCloud/no-personal-data constraints. A Shortcut built on this Mac also cannot be claimed
to work on the target iPhone until it is imported and run there. Therefore the supported deliverable
is the manual recipe below; no `.shortcut` file was generated, signed, or uploaded.
[Apple's Mac export guide](https://support.apple.com/en-qa/guide/shortcuts-mac/apdf01f8c054/mac),
[Apple's Mac import guide](https://support.apple.com/en-gb/guide/shortcuts-mac/apd02bffbaac/mac).

## Choose the source

| Source                      | Practical use                                                                                                                                                                      | Limit                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incoming Message automation | Capture _new_ messages from selected bank senders or phrases. Apple documents the Message trigger with `Sender` and `Message Contains` filters and allows it to run automatically. | Apple's public guide does not document a stable message ID or original receipt timestamp in the trigger input. Verify both on the target device before unattended posting. [Communication triggers](https://support.apple.com/en-ie/guide/shortcuts/apdd711f9dff/ios), [automation execution](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios) |
| Manual historical capture   | Find old messages in Messages, copy the text, and record the displayed original receipt date and time. Send reviewed JSON batches through a private Shortcut.                      | Human review is needed; do not silently substitute the Shortcut run time for the message receipt time. [Search Messages](https://support.apple.com/en-gb/111116), [copy and view timestamps](https://support.apple.com/en-euro/guide/iphone/iph82fb73ba3/ios)                                                                                                             |
| Bank statement CSV          | Backfill large periods of actual bank transactions through the web **Transactions → Import** preview and confirmation flow.                                                        | A statement is financial transaction evidence, not a complete SMS archive. Resolve account, date, and duplicate review in the importer; do not send statement rows as fabricated SMS. [Web import entry point](<../../app/(dashboard)/transactions/page.tsx>), [atomic import endpoint](../../app/api/transactions/import/route.ts)                                       |

Apple's published Shortcuts Find/Filter examples enumerate Photos, Reminders, Calendar Events,
Music, Health Samples, and Contacts, but do not document a **Find Messages** action. Treat a bulk
historical SMS scan by a stock iOS Shortcut as **unverified**; do not design an unattended backfill
around it. This is an inference from the
[documented Find/Filter action list](https://support.apple.com/en-az/guide/shortcuts/apd3c845e881/ios),
not a claim that every current or third-party action has been tested.

## Inbox payload and replay rule

In the signed-in web app, enable **Show API Keys tab** under **Settings → Profile**, then create a
per-user key under **Settings → API Keys**.
[Settings UI](<../../app/(dashboard)/settings/page.tsx>). Use the exact
`https://<web-host>/api/shortcut-inbox` URL, `POST`, `Authorization: Bearer <key>`, and
`Content-Type: application/json`. The body is one JSON object with a `source` and **1–25** `items`.
The body must be **at most 128 KiB**; each `raw_text` is at most 4,096 characters. Use a separate
stable source string for each capture method, for example `sms-shortcut` for live and
`sms-manual-backfill` for historical messages. Source is part of the deduplication key, so
reprocessing the same message under another source can create another inbox row. Full constraints
and response codes are in the [inbox contract](../shortcut-inbox-contract.md).

```json
{
  "source": "sms-manual-backfill",
  "items": [
    {
      "received_at": "2026-09-28T14:32:00-05:00",
      "raw_text": "Synthetic bank notification, not a real payment",
      "external_id": null
    }
  ]
}
```

`received_at` must be the **message receipt instant** in RFC 3339 form with seconds and a timezone
offset or `Z`. Do not use the Shortcut run time, a bank posting date, a guessed time, or a date
without a zone. On iPhone, Apple documents swiping a message bubble left to see timestamps. If the
original time cannot be recovered, hold that message for manual review or use the bank statement
path instead. If a real, stable message identifier is exposed by the input or source export, place
it in `external_id` and retain it across retries. Otherwise use `null`: the server then identifies a
replay by source, normalized text, and exact original receipt instant. Never generate a new random
ID on each run or alter the timestamp to avoid a conflict. Two otherwise identical messages at the
same timestamp need a genuine distinct ID or manual handling.
[Inbox fingerprint implementation](../../lib/shortcut-inbox/intake.ts).

## Build the private batch POST Shortcut

Apple documents `Get Contents of URL` with `POST` and a JSON or File request body, and the
`Dictionary` and `Get Dictionary from Input` actions for JSON data. The following sends one
already-reviewed batch. The **File body** choice is intentional: Shortcuts' inline JSON field editor
is difficult to use for a variable-length array. The exact serialization of a text file in this
action still needs the synthetic device test below.
[Apple API request guide](https://support.apple.com/en-euro/guide/shortcuts/apd58d46713f/ios),
[Dictionary guide](https://support.apple.com/en-tj/guide/shortcuts/apd43b69f337/ios).

1. In the Shortcuts app, use **New Shortcut** and name it `Spends Inbox Batch (Private)`; add
   actions in the order below. This is the supported creation path on Mac and iPhone.
   [Apple's Mac editor instructions](https://support.apple.com/en-au/guide/shortcuts-mac/apd84c576f8c/mac).
2. Prepare a private `.json` file containing the complete object above, replacing the sample with
   **1–25 reviewed messages**. Keep the original file unchanged for retries. Split larger sets into
   numbered files of at most 25 items; ensure each file is under 128 KiB. A prepared JSON file
   avoids inserting unescaped message quotes or newlines into a Text template.
3. Add **Select File** (or the available file-picking action on the installed Shortcuts version) to
   choose one batch file. Add **Get Text from Input**, then **Get Dictionary from Input** using that
   text, then **Get Dictionary Value** for `items` and **Count**. Add **If Count is less than 1** →
   **Stop This Shortcut**, followed by **If Count is greater than 25** → **Stop This Shortcut**. Use
   **Quick Look** on the dictionary during setup and confirm `items` remains an array of
   dictionaries, not one string. Remove Quick Look before routine use.
4. Add **Ask for Input** set to text, with the prompt `Spends inbox API key` and no default answer.
   Add **Text** containing `Bearer ` followed by the Ask for Input variable. This keeps the key out
   of the recipe and batch file, though it is still visible while being typed or in the temporary
   workflow variable. This interactive step is for the **manual batch** shortcut; it cannot run
   unattended.
   [Apple's Ask for Input action](https://support.apple.com/en-au/guide/shortcuts-mac/apd68b5c9161/mac).
5. Add a **URL** action with the HTTPS inbox endpoint, followed by **Get Contents of URL**: Method
   `POST`; Headers `Authorization` = the Text action output and `Content-Type` = `application/json`;
   Request Body `File` = the original selected `.json` file. Do not put the key in the URL or JSON
   file. If the installed version cannot send that file as raw JSON, stop and validate a
   version-specific construction before using real messages.
6. On the response, use **Get Dictionary Value** for `items`, then **Repeat with Each** item. Read
   `index` and `status` from each result. Count both `received` and `previously_received` as saved;
   retain `invalid`, `conflict`, or `error` rows for manual correction or retry. A transport error,
   400, 401, or 413 is a failed batch. HTTP 207 is a partial result, so never treat a completed
   request alone as proof that every item was saved.
   [Response implementation](../../app/api/shortcut-inbox/route.ts),
   [Apple Repeat action](https://support.apple.com/en-gw/guide/shortcuts/apdc11deb2c1/ios).
7. Keep a private local record of which batch file and item indices received each result. Do not
   delete source files until the signed-in web inbox shows the expected rows. Rerun an unchanged
   file after a network failure; successful items return `previously_received`.

**Device validation:** Point the Shortcut at an approved local or staging inbox and use a synthetic
message containing a quote, a newline, and a non-ASCII character. Inspect the inbox and confirm
exact text and original timestamp, then resend the identical batch and confirm `previously_received`
with the same inbox ID. Also test a 2-item file and inspect each result separately. This check is
required because this guide has not executed Shortcuts on the user's iPhone. Do not send the
synthetic test or real messages to production before the deployment and backfill are approved.

## Configure live capture only after the metadata check

1. Create a personal **Message** automation and constrain it to the bank sender(s) or a distinctive
   phrase. Apple's trigger filters are conjunctions when multiple criteria are set. Enable
   immediate/background execution only after a synthetic dry run succeeds on the intended iPhone.
   [Communication trigger](https://support.apple.com/en-ie/guide/shortcuts/apdd711f9dff/ios),
   [automatic execution](https://support.apple.com/guide/shortcuts/add-automations-apdfbdbd7123/ios).
2. Inspect the automation's incoming message variable on that device. Verify it provides the **full
   message text** and an **actual receipt timestamp**; also check whether it exposes a stable
   message ID. Apple's public trigger documentation does not establish these field guarantees. A
   message date or ID found in the message body is not automatically equivalent to the SMS receipt
   metadata. Record the observed iOS version and fields before use.
3. If the receipt timestamp is available, format that _same date value_ with `Format Date` as RFC
   3339/ISO 8601 with seconds and zone; inspect the output, such as `2026-09-28T14:32:00-05:00`.
   Build the one-item JSON dictionary with `source` = `sms-shortcut`, `items` = an array containing
   `received_at`, `raw_text`, and either the verified stable `external_id` or `null`. Send with the
   same URL, headers, and POST action. Test JSON serialization on-device before enabling the
   automation.
   [Apple date formatting](https://support.apple.com/en-ae/guide/shortcuts/apdfb33b0e17/ios).
4. If Shortcuts exposes only the message body or current run date, **do not post to this endpoint
   from an unattended automation**. Save the message for manual capture with its visible timestamp,
   or use the statement CSV path. A product change could add a separately named `captured_at` field,
   but that would require a new server contract and review before use; it must not be passed as
   `received_at`.

Incoming automation applies to **future** trigger events. Creating it does not retroactively
enumerate the Messages history. It also captures only senders/phrases that match its filter. Review
saved items in `/transactions/shortcut-inbox`; intake itself never creates a financial transaction.
Matching an existing transaction and creating a new one both require the signed-in web review flow
described in the [inbox contract](../shortcut-inbox-contract.md).

## Protect the key and source files

- Keep the key in a private Shortcut only. A Shortcut with an embedded bearer key should not be
  shared or exported. Do not paste keys or real message text into issue reports, logs, screenshots,
  sample JSON committed to Git, or links. Apple notes that shared shortcuts warrant privacy review.
  [Shortcuts privacy settings](https://support.apple.com/en-lk/guide/shortcuts/apd961a4fc65/ios).
- Use a dedicated per-user key for this intake so it can be revoked after a historical backfill or
  immediately if exposed. This web inbox accepts the key only for POST; listing, matching, and
  creating transactions require a signed-in browser session. The same user API key may also
  authenticate existing Worker endpoints, so treat it as a full account credential.
  [Auth implementation](../../lib/shortcut-inbox/auth.ts).
- Treat source JSON, screenshots, and `/api/shortcut-inbox/export` as private financial data. Store
  temporary files in a location you control, avoid shared folders, and remove extra copies after
  checking the inbox. Never attach a real export to a public issue or send it to an unrelated
  service. [Export implementation](../../app/api/shortcut-inbox/export/route.ts).
