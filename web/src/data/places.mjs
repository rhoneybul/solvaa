// Directory entries checked against the operator's own website on 2026-09-28.
// These are suggestions, not live availability or verified water access.
export const PLACES = [
  ["dunvegan", "stay", "The Dunvegan rooms", "https://thedunvegan.com/"],
  [
    "dunvegan",
    "food",
    "The Old School Restaurant",
    "https://oldschoolrestaurant.co.uk/",
  ],
  ["dunvegan", "camp", "Kinloch Campsite", "https://kinloch-campsite.co.uk/"],
  [
    "portree",
    "stay",
    "The Royal Hotel, Portree",
    "https://www.royalhotel.scot/",
  ],
  ["portree", "food", "Café Arriba", "https://www.cafearriba.co.uk/"],
  [
    "portree",
    "camp",
    "Portree Campsite, Torvaig",
    "https://portreecampsite.uk/",
  ],
  ["broadford", "stay", "Broadford Hotel", "https://www.broadfordhotel.co.uk/"],
  ["broadford", "food", "Siaway Chippy", "https://cafesia.co.uk/"],
  [
    "broadford",
    "camp",
    "Camping Skye",
    "https://campingskye.com/around-broadford/",
  ],
  ["isleornsay", "stay", "Hotel Eilean Iarmain", "https://www.eiskye.co.uk/"],
  [
    "isleornsay",
    "food",
    "Hotel Eilean Iarmain dining",
    "https://eileaniarmain.co.uk/",
  ],
].map(([routeId, type, name, url], index) => ({
  id: `directory-${index}`,
  routeId,
  type,
  name,
  url,
  source: "Operator directory",
  checkedAt: "2026-09-28",
}));

export const placesForRoute = (routeId) =>
  PLACES.filter((place) => place.routeId === routeId);
