# Bank sender discovery for guided forwarding

The Settings → Email forwarding guide ranks bank search clues using the user's active account names
and institutions. It does not read Gmail or create a filter. The user searches existing mail, opens
a real transaction notice, copies its full `From` address, checks the message, and creates a Gmail
filter for that exact address. The optional helper copies the address itself for Gmail's `From`
field. New forwarded mail enters the review inbox; it does not post a transaction automatically.

The catalogue contains discovery clues for Bancolombia, Lulo Bank, Banco Falabella, Banco de Bogotá,
BBVA, Nequi, Davivienda, and Nu. A discovery clue is **not** a verified sender or an authentication
check. `notificaciones@lulobank.com` is an example observed in user-provided material and must be
checked against the user's own mail. Banco Falabella
[publishes its sending domain](https://www.bancofalabella.com.co/verificacion-comunicaciones-recibidas).
Banco de Bogotá
[lists authorized addresses](https://portalst.bancodebogota.com.co/atencion-al-cliente/seguridad-bancaria/seguridad-comunicaciones-digitales),
including `notificaciones@bancodebogota.net`. Other institutions have no exact sender in the
catalogue because a reliable transaction address was not established.

Gmail's [search operators](https://support.google.com/mail/answer/7190?hl=en-GB) support `from:`
searches. Its [filter workflow](https://support.google.com/mail/answer/6579?hl=en-EN) can forward
matching new mail after the destination is verified. Gmail filters do not expose a general
regular-expression operator. A broad bank name or domain can match promotions or unrelated messages,
so the guide only accepts a complete email address for Gmail's `From` field.

The route status in Spends means the private address exists and the confirmation message was
received. The user can mark the address verified after Gmail confirms it; this is a user
acknowledgement, not a Gmail API check. The full confirmation message stays collapsed by default. If
no new notice arrives, first check Gmail's forwarding-address verification and filter settings, then
send a fresh matching notice and check the review inbox.
