# Optional document OCR web integration

The default image and local PDF text extraction routes are unchanged. An explicit `mistral_ocr`
action uses the private Worker `/documents/extract-pdf-ocr` endpoint. This action is disabled unless
the web server has `DOCUMENT_PDF_OCR_ENABLED=true` and `DOCUMENT_PDF_OCR_PROXY_SECRET`; the Worker
requires its corresponding capability, matching proxy secret, owner JWT, current claim, explicit
`document_ocr` consent, and atomic budget reservation.

The document card discloses OpenRouter, Mistral OCR, and DeepSeek before each optional action,
requires a fresh action acknowledgement, and links missing consent to settings. The disclosure does
not claim end-to-end zero retention. English, Spanish, and Portuguese messages include budget,
claim, capability, input, and allowance recovery text. These controls do not independently establish
provider retention policy or authorize deployment.

## Trusted preparation

Private owner-scoped source bytes remain in server memory. Passwords are rejected for optional OCR;
encrypted PDFs are rejected rather than decrypted or forwarded. Preparation runs in a worker with a
20-second deadline, 128 MiB old-generation and 32 MiB young-generation limits. Native image decoding
is additionally limited to 16 million input pixels and a 10-second transform deadline.

PDF sources are limited to 5 MiB and 1–5 pages. Nonvisual page fields, including annotations, are
removed before copying each page. The copied object graph rejects extra page objects, annotations,
attachments, and executable action markers. This prevents a link annotation from carrying a second
original page inside an apparently single-page PDF. Each resulting page is limited to 1 MiB, total
serialized page bytes to 5 MiB, and is assigned its original one-based page index and SHA-256
digest. The original-byte SHA-256 is retained separately.

PNG, JPEG, and WebP images are decoded only when their detected format matches the stored MIME type.
Animated/multipage images are rejected. A local transform rotates, bounds the image to 2000 × 2000,
flattens transparency to white, and reencodes JPEG without original metadata. The canonical image
becomes one PDF page and uses the same page-byte limits. The original source hash refers to the
uploaded image, not the canonical JPEG.

PDF page serialization preserves visible page resources; it does not claim to prove semantic row
completeness. OCR observations always require owner review. Original page indices and excerpts are
visible in the card's OCR evidence panel beside the existing original-document preview.

## Completion authority

The web validates the Worker draft wrapper, exact completed page count, review-only pathway marker,
observation ceiling of 250/document and 50/page, and source-page range before completing the
owner/claim-scoped RPC. Optional RPC provenance parameters are `p_page_count`, `p_source_sha256`,
and `p_pathway`; each observation includes `source_page`. No transaction-posting endpoint is called.
Failed or partial responses release the claim as failed and never save partial drafts.

## Local verification

Focused tests cover real isolated splitting, hidden page references, annotation stripping,
encrypted/malformed/oversized sources, canonical PNG/JPEG/WebP processing, pixel and MIME rejection,
private route payloads, receipt classification, owner/claim persistence, safe error forwarding,
per-action acknowledgement, and visible page provenance. Upstream provider HTTP and database RPCs
are mocked in route tests; these tests make no paid provider calls and do not validate deployed
native binaries. Production build tracing explicitly includes PDF and native image dependencies.
Deployment and real-document enablement remain separate owner tasks.
