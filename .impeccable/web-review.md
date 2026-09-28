# Web conversion finish review

Reviewed 28 September 2026. Direction: `user-slopes`, pinned by the user. Code-led implementation; no approved comp or separate quality-bar card. The reviewer evaluated the direction contract and rendered desktop/mobile surfaces, not pixel fidelity to a comp.

## Initial review

Disposition: **fix**.

- Persistence: PRODUCT.md and the five-block surface contract present.
- Fidelity: typography, map material, light ground, desktop composition, guest flow and product disclosures matched. Mobile composition contradicted the map-after-composer promise.
- Ceiling: not scored without a separate quality-bar card.
- Material fixes: move the mobile map ahead of results; move route effort, day context and saved-trip metadata below headings; remove the redundant “On the map” label.
- Keep: desktop map scale, compact activity statistics, guest use and the distinction between planning outlines and navigation tracks.

## Fix verification

Disposition: **ship** for the scored fixes. Both requests were visually verified; no visible regressions were found in the fix batch. All four itinerary day labels are present.

The mobile map is rendered after the composer and presets in DOM order, followed by route results. At 390px wide its top is 736px, results begin at 1206px, and document width remains 390px. Heading metadata appears below its title across route results, details, itinerary, map sheets and saved trips.

Valid captures are in the ignored `.impeccable/review/` directory: `mobile-final.png`, `mobile-full-final.png`, `itinerary-desktop-final.png`, `route-details-final.png`, `saved-trips-final.png`, `profile-desktop.png` and `route-photos-final.png`. The full mobile capture uses a tall viewport because the browser's stitched full-page capture produced a malformed image; that image was replaced, not used as evidence.

The one detector run reported Inter font warnings. Retaining Inter is deliberate: it is required by the incumbent project guidance and supports the selected activity-planning interface. No generated or downloaded raster is shipped as a design asset. Map tiles and route photos are external runtime content with in-product attribution; profile photographs belong to the user and stay in browser storage.
