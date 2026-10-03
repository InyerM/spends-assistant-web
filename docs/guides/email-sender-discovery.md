# Bank sender discovery for guided forwarding

The Settings → Email forwarding guide ranks bank search clues using the user's active account names
and institutions. It does not read Gmail or create a filter. The helper starts with `bancolombia` as
a distinctive word and accepts more bank words, one per line. It generates a Gmail OR search such as
`{bancolombia lulobank}` across sender, subject, and message content. An optional section accepts
exact sender addresses for notices that omit the bank word, producing terms such as
`from:alerts@bank.example`. Invalid operators, incomplete addresses, and domain-only sender entries
disable copying rather than broadening the search unexpectedly. The user pastes the generated search
into Gmail's main search box, checks the results, and then creates the forwarding filter in Gmail.
New forwarded mail enters the review inbox; it does not post a transaction automatically.

The catalogue contains discovery clues for Bancolombia, Lulo Bank, Banco Falabella, Banco de Bogotá,
BBVA, Nequi, Davivienda, and Nu. A discovery clue is **not** a verified sender or an authentication
check. `notificaciones@lulobank.com` is an example observed in user-provided material and must be
checked against the user's own mail. Banco Falabella
[publishes its sending domain](https://www.bancofalabella.com.co/verificacion-comunicaciones-recibidas).
Banco de Bogotá
[lists authorized addresses](https://portalst.bancodebogota.com.co/atencion-al-cliente/seguridad-bancaria/seguridad-comunicaciones-digitales),
including `notificaciones@bancodebogota.net`. Other institutions have no exact sender in the
catalogue because a reliable transaction address was not established.

Gmail's [search operators](https://support.google.com/mail/answer/7190?hl=en-GB) support `from:` and
`{ }` OR searches. Its [advanced search](https://support.google.com/mail/answer/6593?hl=en) includes
"Has the words" and can create a filter from the search. Its
[filter workflow](https://support.google.com/mail/answer/6579?hl=en-EN) forwards matching new mail
after the destination is verified. Gmail filters do not expose a general regular-expression
operator. A broad bank word can also match promotions, codes, unrelated messages, or impersonation.
The Worker shows the unverified sender, separates obvious non-financial mail, and leaves uncertain
mail pending. It omits detected security-code content before storage or AI triage. The helper does
not save the Gmail search in Spends; the created Gmail filter is the durable configuration.
Forwarded email attachments are not processed by the current intake path.

The route status in Spends means the private address exists and the confirmation message was
received. The user can mark the address verified after Gmail confirms it; this is a user
acknowledgement, not a Gmail API check. The full confirmation message stays collapsed by default. If
no new notice arrives, first check Gmail's forwarding-address verification and filter settings, then
send a fresh matching notice and check the review inbox.
