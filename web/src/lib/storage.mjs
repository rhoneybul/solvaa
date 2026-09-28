import { openDB } from "idb";

export const INITIAL_STATE = {
  profile: {
    name: "",
    home: "",
    level: "beginner",
    dailyDistanceKm: 8,
    paceKmh: 3.5,
    skills: [],
    bio: "",
  },
  activities: [],
  photos: [],
  plans: [],
};
let database;
const getDatabase = () =>
  (database ||= openDB("solvaa-web", 1, {
    upgrade(db) {
      db.createObjectStore("records");
    },
  }));
export async function loadState(account = "guest") {
  const db = await getDatabase();
  const state =
    (await db.get("records", `workspace:${account}`)) ||
    (account === "guest" ? await db.get("records", "workspace") : null);
  return state
    ? {
        ...INITIAL_STATE,
        ...state,
        profile: { ...INITIAL_STATE.profile, ...state.profile },
      }
    : structuredClone(INITIAL_STATE);
}
export async function saveState(state, account = "guest") {
  await (await getDatabase()).put("records", state, `workspace:${account}`);
}
export function download(content, name, mime = "application/json") {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type: mime }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function preparePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > 12 * 1024 * 1024)
    throw new Error("Photos must be smaller than 12 MB.");
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  // Re-encoding removes embedded location metadata from the stored photograph.
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob)
    throw new Error("This photo could not be read. Try another image.");
  return {
    id: crypto.randomUUID(),
    name: file.name,
    blob,
    caption: "",
    skill: "",
    createdAt: new Date().toISOString(),
  };
}
