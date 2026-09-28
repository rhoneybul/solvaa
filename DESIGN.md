---
name: "Solvaa Web"
description: "A Slopes-inspired map and data-sheet system for paddling plans."
colors:
  blue: "#2465d8"
  blue-deep: "#174ca9"
  ink: "#202b38"
  muted: "#606e7d"
  line: "#e1e7ed"
  pale: "#edf3fd"
  surface: "#fff"
  canvas: "#f5f7f9"
  inset: "#f5f7fa"
  field-border: "#cfd8e1"
  secondary-ink: "#34475c"
  secondary-border: "#d5dfe8"
  secondary-hover: "#f0f5fa"
  easy: "#376f5c"
  moderate: "#90682b"
  challenging: "#9b4a43"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.17
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.17
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  metric:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    letterSpacing: "-0.04em"
rounded:
  chip: "6px"
  control: "8px"
  button: "9px"
  tile: "10px"
  sheet: "14px"
  map-sheet: "16px"
spacing:
  space-6: "6px"
  space-8: "8px"
  space-12: "12px"
  space-14: "14px"
  space-16: "16px"
  space-18: "18px"
  space-20: "20px"
  space-24: "24px"
  space-28: "28px"
  space-32: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-primary-hover:
    backgroundColor: "{colors.blue-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary-ink}"
    rounded: "{rounded.button}"
    padding: "12px 17px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-text:
    textColor: "{colors.blue}"
    typography: "{typography.label}"
    padding: "2px 0"
  button-icon:
    textColor: "{colors.muted}"
    rounded: "7px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  place-filter:
    rounded: "{rounded.control}"
    padding: "9px 10px"
  place-filter-selected:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.blue-deep}"
  profile-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    padding: "27px"
  navigation-link:
    textColor: "#657285"
    padding: "0 3px"
  navigation-link-active:
    textColor: "{colors.blue}"
  setup-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  setup-sheet:
    backgroundColor: "{colors.surface}"
    rounded: "20px"
    padding: "36px 40px"
  day-tab:
    backgroundColor: "#f2f5f7"
    rounded: "7px"
    padding: "9px 12px"
  day-tab-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
---

# Design System: Solvaa Web

## Overview

**Creative North Star: "The Map and the Planning Sheet"**

Solvaa pairs a working geographic canvas with calm white planning sheets. The user-pinned Slopes reference supplies map prominence, clear activity statistics, restrained controls and straightforward navigation. Cool slate text, functional accents and fine rules organize a compact workspace.

This is a descriptive refresh of the existing web system after the map-first refinement, not a new world or approved visual comp. The incumbent North Star and Inter identity remain. No retrospective concept seed or QUALITY BAR card is claimed. The build takes precedence over provisional direction measurements and color names.

**Key Characteristics:**
- Geography stays prominent while details appear when needed.
- White sheets and fine dividers group practical information.
- Functional color connects actions, selection and user-drawn geometry.
- Tabular statistics and SVG line icons support quick reading.

## Colors

Cool slate neutrals and white surfaces let geography carry the scene. The frontmatter records reused colors; local place-category tints remain contextual rather than new brand accents.

### Primary

- **Planning Blue** (`blue`): actions, selected controls, active navigation and route traces.
- **Deep Planning Blue** (`blue-deep`): primary hover and selected filter text.
- **Pale Blue** (`pale`): quiet selection surfaces.

### Secondary

The retained effort colors (`easy`, `moderate`, `challenging`) belong to legacy route records, not the new manual route's validation status. Point markers distinguish launch, food, camping and accommodation with labels and Lucide symbols as well as color.

### Neutral

Slate Ink and Muted Slate supply principal and supporting text. White Surface and Cool Canvas distinguish content from page surround. Fine Rule and Field Border separate content and editable boundaries. Secondary Ink, Border and Hover preserve the outlined action vocabulary. Inset Mist remains in grouped profile content.

**The Functional Color Rule.** Use the accent for action, selection and the person's line. A line color never certifies a navigable route.

## Typography

**Display and Body Font:** Inter, with ui-sans-serif, system-ui and sans-serif fallbacks. Actual bundled weights are 400, 500 and 600.

Compact headings and medium-weight statistics carry the hierarchy without a separate display face.

### Hierarchy

- **Display:** Planner task heading, 26px at desktop and 24px on mobile; inherits the base heading tracking and line-height.
- **Headline:** Base h1 at 32px. Account and setup use line-height 1.2, reducing to 29px at 800px. Profile uses 28px, 25px and 23px at its breakpoints.
- **Title:** Base h2 at 18px; place-list headings use 15px. Base h3 is 14px, weight 600 and line-height 1.5.
- **Body:** Root 14px with paragraph line-height 1.65. Planner supporting text is 13px, reducing to 12px on mobile.
- **Label:** Normal-case 12px, weight 500; setup labels are 13px and map search labels 14px.
- **Metric:** Plotted distance uses 32px, weight 500, tight tracking and tabular numerals, with 14px units. Profile totals retain their 28px scale.

**The One Family Rule.** Keep Inter, weight 600 headings and weight 500 tabular metrics. Existing tiny attribution and legacy microcopy are not an additional reusable type tier.

## Layout

The map application has a 72px desktop header and a maximum workspace width of 1800px. A task toolbar uses 25px 32px padding, then a 350px controls column sits beside the remaining-width map. The panel uses 24px padding. The sticky map begins below the header and uses `calc(100svh - 184px)` height with a 480px minimum. Long controls remain in document flow.

At 800px and below, a sticky 64px header retains the account button. Explore, Saved and Profile move to a fixed bottom bar, 60px plus the safe-area inset. Its links have 82px minimum width and 58px minimum height. Page bottom padding reserves the bar's space. The map precedes the detail panel, using 46svh height, a 330px minimum and 540px maximum. Panel padding becomes 24px 20px 32px. The task toolbar wraps and uses 20px padding.

Profile and saved routes retain a centered 1260px maximum width with 46px 42px 70px desktop padding. Profile has a flexible content column, 270px summary column and 28px gap; columns stack at 800px. Photo evidence becomes one column at 480px.

Setup and Account retain single-column sheets with 640px and 500px maximum widths, 20px corners and 36px 40px padding. At 800px they become borderless white document surfaces with 20px horizontal page padding. Setup starts with 24px top padding. The Home picker is a 250px-high geographic canvas. Forms use 20px group gaps and a safe-area-aware footer.

Spacing remains pragmatic: 6–14px control gaps, 18–28px group separation, and larger page padding. Preserve component-specific measurements rather than imposing a new arithmetic scale.

## Elevation & Depth

Bordered white sheets remain flat on the pale canvas; controls over geography and transient feedback receive soft shadows. Hard offset shadows are not part of this world.

### Shadow Vocabulary

- **Ambient feedback:** `0 8px 32px #2033451a`, toast and floating area menu.
- **Map controls:** `0 2px 12px #243b4826`, stacked map controls.
- **Map actions:** `0 2px 10px #243b4820`, basemap and search-area actions.
- **Drawing actions:** `0 3px 14px #243b4830`, point placement and undo.
- **Field focus:** `0 0 0 3px #2465d814`, paired with the accent border.

**The Floating Sheet Rule.** Reserve soft elevation for controls over geography and transient feedback. Ordinary content sheets use a fine border.

## Shapes

Fields and place filters share gently curved 8px corners; primary and secondary buttons use 9px. Map control stacks use 10px, profile sections 14px and setup sheets 20px. Day tabs use 7px corners. Place rows stay flat and divided. Account identities and route markers are circular.

Lucide SVG line icons normally occupy 16–24px with stroke width 1.8. Real map tiles and user-created polylines provide the irregular geometry. First-save traces use round SVG joins and caps.

## Components

### Buttons

Primary buttons use accent fill and white text; secondary buttons use white with a fine outline. Both retain 13px weight 600 type, 12px 17px padding and 42px minimum height. Hover transitions last 150ms. Text actions underline on hover; icon actions receive a pale hover fill. Disabled controls retain geometry with opacity 0.6.

Keyboard focus uses a 3px blue outline at 4px offset. Main mobile actions and planner icon controls are at least 44px; some map layer/search controls remain 42px. Account tabs and place-search result controls use 48px minimum heights.

### Chips and day tabs

Place filters form a two-column grid of labeled icon buttons. Selected filters use pale accent fill, a tinted border and deep accent text. Horizontally scrolling day tabs use a pale neutral resting fill and ink fill with white text when selected. These separate selection patterns keep day choice distinct from map-place filtering.

### Cards / Containers

Profile sections retain white fill, fine borders, 14px corners and 27px desktop padding. Place results use divided rows, with selected text in the action color. Key points, coordinates, dates, notes and GPX review sit behind labeled disclosures. Visible chevrons rotate when details open.

### Inputs / Fields

Fields retain white fill, an 8px radius, a fine border and 11px 12px padding. Focus changes the border to the accent and adds the subtle halo. Account and setup fields use 16px text and 48px minimum height. Mobile forms use 16px text; route titles deliberately use 20px. Non-checkbox mobile inputs and selects have at least 44px height. Inline errors and success messages pair text with contextual color.

### Navigation

Explore, Saved and Profile are the three persistent destinations; Account is a separate labeled-accessible header button with a circular identity. Active links use the accent and baseline indicator. Desktop navigation is centered; phone navigation lives in the reserved bottom bar with icons above 11px labels. Toasts move below the mobile header, clear of that bar.

### Setup and account flow

Setup has two steps, Home and Experience, with numbered 24px progress circles and checks for completed steps. Step headings receive focus. Approximate home can be set on a geographic map or by coordinates; search is conditional on availability. Experience questions precede optional evidence and profile adjustments, which remain in the same second step. Skip for now remains available.

Production email authentication precedes the workspace. The account sheet supports email/password sign-in, account creation and recovery. A missing production configuration shows an explanatory state without a guest bypass; development preview may allow guest continuation. Profile and saved routes synchronize when connected; drafts, photos and imported sessions remain local. Optional AI reading stays unavailable by default, with configured use requiring account, verified email and consent. These states must be expressed accurately in form and feedback copy.

### Geographic planning and first save

Leaflet presents runtime OpenStreetMap/Esri tiles and attributed geographic places. Users choose their own key points, by map interaction or center-point placement, and can undo or edit coordinates. Each day is drawn separately. The map's active line is blue and other days are muted; straight segments remain explicitly unvalidated. Export review requires acknowledgement and preserves separate daily tracks. Earlier catalog records keep their notes and cannot be exported as manual routes.

The first save displays the actual saved geometry as one SVG polyline per day, with a small success check and next action. A 750ms `cubic-bezier(0.2, 0.8, 0.2, 1)` stroke reveal gives this moment emphasis. The preview is 112px on desktop, 100px on mobile; saved-list previews use 86px and 64px. Reduced-motion settings remove the animation and retain the completed shape. No invented celebration path is a substitute for the saved route.

There are no new raster assets. Geographic imagery comes from attributed tile services; interface symbols are Lucide and route previews are data-derived SVG vectors. User photos remain local evidence. The sidecar's synthesized eight-step OKLCH ramps are panel previews, not shipped palette additions.

## Do's and Don'ts

### Do:

- **Do** retain Inter, labeled SVG icons, fine rules and clear statistical units.
- **Do** keep map attribution, place sources and manual-line limitations visible.
- **Do** preserve the mobile map-before-panel order and space for bottom navigation.
- **Do** preserve keyboard focus, readable mobile fields and reduced-motion handling.
- **Do** celebrate the saved line and describe local versus synchronized data honestly.

### Don't:

- **Don't** imply that straight segments or approximate launch points are validated navigation.
- **Don't** join separate days with an invented transfer line.
- **Don't** treat photos or distance as evidence of certified technical competence.
- **Don't** reintroduce generated catalog routes into active place finding.

Evidence: `web/src/styles.css`, `web/src/plot.css`, `web/src/main.jsx`, `web/src/App.jsx`, `web/src/components/{MapPlanner,PlotMap,HomeMap,Onboarding,Account,Profile}.jsx`, `PRODUCT.md` and `.impeccable/web-surface.md`. This pass reconciles source; it does not assert an independent browser review or a final finish verdict.

Not canonized or repaired: tiny legacy microcopy and map attribution, 42px map actions. They are observed drift, not new system rules; this pass owns documentation only.
