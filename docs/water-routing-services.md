# Water routing for Solvaa

Research checked 28 September 2026. This is a service and architecture assessment, not an implementation or a claim that existing GPX crossings have been fixed. No accounts were created, vendors contacted, or authenticated routing requests run.

## Recommendation for the Skye coastal case

**Stop treating AI-written coordinates as a routed paddling track.** AI can select destinations, launch points, day stages and preferences. A deterministic router must construct the path between them, and a separate geometric validator must check the exact path that will be exported. Adding more AI-generated points or interpolating an existing line cannot establish that it avoids land.

My recommended order is:

1. **Immediate product correction:** distinguish an itinerary outline from validated route geometry. Until actual routing is integrated, use reviewed/imported coastal GPX tracks and withhold navigation-track export for an unvalidated outline. A land-crossing validator catches an error; it does not calculate the missing route around a headland.
2. **First commercial enquiry: Savvy Navvy's Savvy Integrated.** It is the closest documented product match: the consumer product has kayak mode, and its current partner offering explicitly includes routing inside other companies' systems. However, integration access, a kayak-capable headless API, geometry export, UK coverage and commercial rights remain vendor questions. This is a partnership lead, not a drop-in public API. Sources: [kayak product](https://www.savvy-navvy.com/kayak), [September 2026 integration announcement](https://www.savvy-navvy.com/news/savvy-navvy-partners-with-marinminds-helm-display).
3. **If Solvaa wants an open-source solution it controls:** build a bounded coastal planning router from detailed water geometry, starting with a supported Skye area, and keep the independent validator. This is a real geospatial engineering project. Use BRouter separately for connected inland river/canal networks; its river profile is not a general open-sea routing solution. The upstream profile admits river/canal/fairway/lock-gate ways and disables beeline additions. Source: [BRouter river profile](https://github.com/abrensch/brouter/blob/master/misc/profiles2/river.brf).
4. **Evaluate shipping APIs only as geometry candidates.** Searoutes and Aquaplot expose real route APIs, but their documented ship-routing models do not establish suitable coastal kayaking paths. Prove performance against Solvaa's actual Skye cases before choosing one. Sources: [Searoutes sea endpoint](https://developer.searoutes.com/reference/getsearoute), [Aquaplot API](https://www.aquaplot.com/api/docs/).

No reviewed public documentation establishes an off-the-shelf API that produces paddler-appropriate, navigation-ready Skye routes. That is a research limit, not proof that no vendor can supply one.

## What the candidates actually offer

| Candidate | Verified integration capability | Fit and decision |
| --- | --- | --- |
| **BRouter + river/canoe profile** | Self-hostable Java HTTP router, custom profiles, GeoJSON output and MIT-licensed engine. OSM-derived routing segments are available or can be generated. [Upstream project](https://github.com/abrensch/brouter) | Best open-source starting point for connected inland waterways. Requires separate open-water routing for coastal Skye and lakes without a suitable mapped network. |
| **Savvy Navvy / Savvy Integrated** | Kayak mode is marketed; the consumer guide documents GPX export. Its September 2026 partner announcement includes apps, charts, tides, weather and routing. No public routing endpoint, response schema or API price was located in the reviewed sources. [Kayak](https://www.savvy-navvy.com/kayak), [GPX guide](https://www.savvy-navvy.com/user-guide/planning-a-route-2), [partner integration](https://www.savvy-navvy.com/news/savvy-navvy-partners-with-marinminds-helm-display) | First commercial partner to investigate. Consumer GPX export offers a possible manual import workflow; it is not permission to automate private app endpoints. |
| **Searoutes** | Publicly documented `GET https://api.searoutes.com/route/v2/sea/{locations}`. Accepts up to 20 coordinate/UNLOCODE positions; returns route, distance and duration. Supports draft and inland waterways; uses traffic separation schemes and port entries. [Endpoint](https://developer.searoutes.com/reference/getsearoute) | Straightforward server integration candidate, but shipping constraints differ from kayak preferences. No documented kayak mode, maximum open-water crossing, beach landing or paddler exposure model found. |
| **Aquaplot** | Documented `GET /v1/route/from/{lng}/{lat}/to/{lng}/{lat}` and bulk `POST /v1/routes`; GeoJSON LineString response, custom no-go areas and coordinate validation. Ship-oriented. [API docs](https://www.aquaplot.com/api/docs/), [API product](https://www.aquaplot.com/api) | Another implementable candidate, particularly for custom exclusion zones. Shoreline snapping and unmapped inland water require scrutiny; no documented kayak profile. |
| **Datalastic** | `GET https://api.datalastic.com/api/ext/route` accepts coordinates or port identifiers and returns GeoJSON geometry and nautical-mile distance; authenticates with `x-api-key`. [Official reference](https://docs.datalastic.com/) | A real sea-route endpoint, but the published route parameters do not demonstrate a paddling/coastal suitability model. Lower priority than a specialist recreational partner. |
| **Vector Charts** | Documented `POST /api/v1/routing/route?token=...`; ordered `[latitude, longitude]` waypoints and returned coordinate path. Explicitly a **feature preview restricted to pilot customers**. [Route API](https://docs.vectorcharts.com/api-reference/route/) | Technically relevant but not an established Skye option: current coverage page lists US charts and low-resolution Natural Earth global background. UK chart licensing and routing coverage must be confirmed. [Coverage](https://vectorcharts.com/coverage) |
| **i-Boating SDK** | Product page advertises integrating charts, bathymetry and routing engines, including a web SDK. Detailed SDK page and browser examples largely document mapping and route editing, not a public compute-route contract. [Integration offering](https://www.gpsnauticalcharts.com/main/natuical-charts-app-software), [SDK](https://www.gpsnauticalcharts.com/main/marine-maps-sdk), [web examples](https://www.gpsnauticalcharts.com/main/sdk-examples.html) | Second recreational SDK enquiry if Savvy is unsuitable. Confirm whether an actual route-computation interface and export rights are offered for Solvaa's web use case. |
| **Garmin/Navionics** | Public web API is for embedding charts. Standard is a free chart viewer, disallows additional overlays and requires a free end-user service. Enhanced is paid and permits commercial use with overlays. [Official developer page](https://developer.garmin.com/marine-charts/web/) | Useful chart layer under the appropriate agreement. Published web API documentation does not establish access to the consumer product's autorouting engine. Do not equate chart access with routing access. |
| **Open-source `searoute-py`** | Produces sea-route GeoJSON and accepts custom networks. Its maintainers explicitly describe it as visualization software, not a mariner's router. [Upstream README](https://github.com/genthalili/searoute-py) | Reject as the source of navigation-ready kayaking GPX. A realistic-looking global shipping line does not solve the near-shore problem. |

### Costs and access that were actually confirmed

- BRouter's engine is MIT licensed; operating and refreshing a hosted instance still costs resources. Do not assume a public demo server is a supported production dependency. [BRouter](https://github.com/abrensch/brouter).
- Searoutes currently lists Ocean Routing at **€400 billed monthly**, starting from **3,000 calls per month**. This is a published price signal, not a quote for Solvaa's licensing or workload. [Official pricing](https://searoutes.com/en/pricing).
- Vector Charts lists free US chart prototyping and paid chart plans, but its route endpoint requires pilot access. Its chart prices should not be presented as a confirmed Skye routing price. [Pricing](https://vectorcharts.com/pricing), [routing preview restriction](https://docs.vectorcharts.com/api-reference/route/).
- i-Boating directs SDK customers to contact it for pricing. No confirmed Savvy Integrated, Aquaplot or Datalastic routing quote was obtained. [i-Boating SDK pricing](https://www.gpsnauticalcharts.com/main/marine-maps-sdk).

### BRouter profile caveats

The community canoe profile is more expressive than the minimal upstream river example: it includes river direction/flow, canal costs, barriers, locks and carrying a portable boat. Its `portable_boat` default is enabled, and some restricted/barrier cases become expensive traversable edges rather than absolute exclusions. Solvaa should not assume that selecting a profile named “canoe” guarantees an uninterrupted water-only track. Preserve explicit portage metadata or reject such edges for a water-only export. This assessment follows the actual profile code. [Canoe profile source](https://github.com/afischerdev/brouter-profile/blob/master/river_canoe_nomod.brf).

The profile collection distinguishes profiles that use standard routing data from versions requiring modified lookup data. Verify the chosen profile, lookup table and segment generation together. [Maintainer README](https://github.com/afischerdev/brouter-profile).

### Commercial API integration caveats

Aquaplot documents minor endpoint corrections up to roughly 100 metres and a validation response containing `suggestion` and `moved_by`. A suggestion may be far away when the coordinate is not in its routable waters, including some lakes. Reject excessive movement and validate the endpoint connectors; never silently relocate a beach launch to another bay. [Aquaplot validation and routing docs](https://www.aquaplot.com/api/docs/).

Searoutes' vessel draft parameter and small default vessel do not establish kayak behavior. Its product is explicitly positioned around freight, vessel routes and maritime analytics. Route geometry may be useful, but a kayak-sized draft alone does not imply shore-hugging paths, acceptable crossings or landing access. [Sea endpoint](https://developer.searoutes.com/reference/getsearoute), [ocean routing product](https://searoutes.com/en/products/ocean-routing).

## Proposed architecture

The following is an engineering recommendation, not an assertion about any provider's existing implementation.

```text
AI itinerary / user waypoints
            |
            v
Verified launch + landing points, day stages, explicit travel modes
            |
            v
Router selected by water type
  inland network: BRouter/custom OSM graph
  coast / open loch: coastal water mesh or qualified provider
            |
            v
Independent full-geometry water / obstacle validation
            |
            v
Store route geometry + source/data version + validation result
            |
            v
Export exact validated geometry, separated by day and travel mode
```

1. **Keep planning intent separate from path geometry.** The AI supplies places and constraints, not authoritative navigation vertices. Resolve named places to known launch/landing locations and record their provenance. Have separate `paddle`, `portage`, `road-transfer` and `ferry` legs. A multiday itinerary may be discontinuous by design.
2. **Use the correct routing model.** An inland graph follows mapped waterway connections and annotated barriers. Coastal/open-loch routing needs a traversable water area: for example a constrained mesh or adaptive grid with A*/Dijkstra search. Every graph edge must be contained within the allowed water area, including diagonal edges and endpoint connections. A coast-distance preference is a planning parameter, not a universal safety rule.
3. **Validate whole lines.** Both endpoints can be in water while the joining segment crosses a headland or island. Run a full LineString/polygon relationship test against the permitted water surface, preserving polygon holes and small islands. `ST_CoveredBy(route, allowedWater)` tests every point of the line, including its boundary relationship. PostGIS explicitly warns that invalid geometries can produce unexpected results: validate the dataset first and fail on invalid/missing geometry. [PostGIS `ST_CoveredBy`](https://postgis.net/docs/ST_CoveredBy.html).
4. **Use detailed geometry, not a world map backdrop.** The OSM-derived water polygon dataset is coastal: it explicitly excludes inland lakes and reservoirs. Combine the non-simplified coastal water geometry with separate inland water polygons. Keep the polygon union seamless at river mouths and tile boundaries; preserve island holes. The dataset offers a simplified zoom-0–9 variant that should not be the validation mask for near-shore paddling. [OSM water polygons](https://osmdata.openstreetmap.de/data/water-polygons.html).
5. **Avoid a second straight-line bug after routing.** Never append raw input waypoints to provider geometry without validating the connectors. Revalidate after rounding, simplification or edits. Bind the validation result to the exact stored/exported geometry, for example with a geometry hash and data version. Do not densify an invalid line and call it corrected.
6. **Fail closed for route export.** Provider failure, missing data, excessive snapping, an unconnected graph, invalid polygons or a land intersection should leave the itinerary usable as an outline but prevent a supposedly routed paddling GPX. Preserve a reason the UI can explain. Never fall back to an AI polyline or a direct line.
7. **Export separated stages.** Prefer one GPX per paddling day; within a day, use separate tracks/segments for discontinuous paddles. Keep portages/transfers separately labelled and excluded from the paddling track. Never join yesterday's take-out and today's launch with a synthetic paddle line. GPX supports tracks containing multiple track segments. [GPX 1.1 schema](https://www.topografix.com/gpx/1/1/).

## Limits the implementation must represent

**A coastline check establishes geometry relative to a dataset, not navigability at a particular time.** OSM's coastline convention is mean high-water springs. Consequently, areas seaward of that line may still expose at low tide, and a static water mask does not represent tide races, currents, sea state, submerged hazards or acceptable conditions for a given paddler. [OSM coastline definition](https://wiki.openstreetmap.org/wiki/Tag:natural%3Dcoastline).

**Detailed data still has gaps and age.** OSM-derived land/water processing repairs some coastline errors but can stop publishing updates if it cannot repair the source. Record the actual data timestamp, monitor coverage and reject unknown areas. The land product includes continents and islands, but it is also coastline-derived; a raw land mask cannot alone establish valid inland lake/river water. Data is ODbL licensed. [Land polygon data and processing caveat](https://osmdata.openstreetmap.de/data/land-polygons.html), [water polygon coverage](https://osmdata.openstreetmap.de/data/water-polygons.html).

**Safety margins require local handling.** Buffering land outward can help account for positional uncertainty but may erase narrow channels and block legitimate beach access. Do not silently reduce the margin until a route passes. Represent controlled launch/landing corridors, the reason for any exception and its extent. A universal “keep close to the coast” rule can also produce poor routes near exposed cliffs or breaking waves; environmental and landing constraints need separate review.

## Acceptance cases before any coastal provider is selected

Use actual Solvaa source/destination locations and retain the returned route fixtures, provider version and independently checked geometry. These are proposed pass/fail tests, not tests run during this research.

| Case | Required result |
| --- | --- |
| Two water endpoints with a Skye headland between them | Validated route goes around the headland; direct chord rejected. |
| Route would cross a small island/islet | Island hole preserved; no skipped obstacle between sampled vertices. |
| Valid inland loch route | Accepted using inland water geometry even though the coastal dataset excludes the loch. |
| Disconnected waters | No water route; explicit transfer required. |
| Route needs a portage | Portage distinguished and excluded from the continuous paddling track. |
| Launch snaps across a peninsula or into a different bay | Reject or require a corrected launch; no invisible relocation. |
| Provider timeout, no route, missing tile or invalid polygon | No direct-line fallback and no validated-track export. |
| Vertex edit, export rounding or simplification introduces land crossing | Validation invalidated and exact final geometry rechecked. |
| Multi-day plan uses a road/ferry transfer | Separate daily paddles; no artificial line between them. |
| Known tidal drying area or narrow tidal passage | Geometry result never presented as a time-specific navigability guarantee. |

## Questions that determine the commercial choice

For Savvy Integrated first, then any alternative shortlisted provider:

- Can Solvaa submit arbitrary UK coastal kayak launch/landing coordinates and receive the complete computed geometry through a supported API or web-compatible SDK?
- Are Skye's small islands, beaches, sea-loch entrances and narrow channels covered at a suitable scale? What are the source, update cycle and uncertainty?
- Does the engine support kayaks/canoes, crossings, exposed coasts, tidal streams and explicit no-go areas? Which are actual routing constraints versus display-only information?
- What snapping is performed, how is it reported, and can connectors cross land?
- May Solvaa store, display, edit and export the returned geometry as GPX, including for users without the vendor's own subscription? May it validate that geometry against another dataset?
- What are routing-specific pricing, request limits, data licensing, cache rules, service guarantees and unsupported-region behavior?

Choose a provider only after those answers and the Skye acceptance cases. A consumer app subscription, a chart-display API and a ship-routing API each provide different capabilities; none should be assumed to include the other two.
