# Contact directory layout alignment

## Direction

Align the existing directory with the budget module's centered content width, responsive gutters,
header hierarchy and semantic color tokens. Use compact two-column cards on desktop and one column
on narrow screens. A dense table would require a separate mobile representation; the compact cards
retain the existing contact-opening interaction.

## Changes

- Center content within a 72rem container with responsive horizontal padding and top spacing.
- Group shared search, result count and scan coverage within one toolbar surface.
- Disclose unresolved coverage details progressively and label the scan action “Refresh contacts” in
  English.
- Remove the card component's default vertical padding where the interactive child owns padding.
- Preserve readable wrapping for long names, masked financial identifiers, keyboard focus and
  contact history access.
- Use ICU plural messages for contact and movement counts in Spanish, English and Portuguese.
- Render the original time label and AI status in the same header structure as other reviewed
  fields, retaining an accessible named group.
- Constrain transaction editor grid tracks and evidence blocks; wrap long original URLs within the
  modal.

## Guidance and verification

UI/UX Pro Max's explicit UX search returned applicable web text-reflow guidance: use content-driven
sizing and prevent horizontal overflow. The product's existing budget page provides the concrete
layout and tokens.

Browser verification with synthetic data at 1440px and 390px confirmed no document or editor
overflow. Editor client/content widths were respectively 498/498px and 356/356px. Time labels
remained 7px inside their field border. Temporary fixture routes and test users were removed.

The directory test covers contact opening, identifier masking, singular count copy and collapsed
scan details. Existing field and evidence tests cover original content and analysis behavior. A
previous inbox assertion is scoped to its confirmation dialog because matching movements are now
deliberately also shown in the review list.
