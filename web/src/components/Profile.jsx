import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  UserRound,
  Upload,
  ImagePlus,
  FileUp,
  Check,
  Plus,
  Trash2,
  Waves,
  MapPin,
  Clock3,
  Route,
  ShieldCheck,
  Download,
} from "lucide-react";
import { parseActivityFile, summarizeActivities } from "../lib/activities.mjs";
import { preparePhoto, download } from "../lib/storage.mjs";
import { formatHours, localDate } from "../lib/geo.mjs";

const SKILLS = [
  "Forward paddling",
  "Bracing",
  "Self rescue",
  "Assisted rescue",
  "Tidal planning",
  "Coastal navigation",
];

function PhotoEntry({ photo, update, remove }) {
  const [url, setUrl] = useState("");
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(photo.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo.blob]);
  return (
    <article className="evidence-photo">
      <img src={url || undefined} alt={photo.caption || photo.name} />
      <div className="photo-edit">
        <label>
          What did you practise?
          <input
            aria-label={`Caption for ${photo.name}`}
            maxLength={200}
            value={photo.caption || ""}
            placeholder="A little context for this session"
            onChange={(event) => update({ caption: event.target.value })}
          />
        </label>
        <label>
          Related skill
          <select
            value={photo.skill || ""}
            onChange={(event) => update({ skill: event.target.value })}
          >
            <option value="">Choose a skill</option>
            {SKILLS.map((skill) => (
              <option key={skill}>{skill}</option>
            ))}
          </select>
        </label>
        <button
          className="text-button danger"
          onClick={() => (confirm ? remove() : setConfirm(true))}
        >
          <Trash2 size={14} />
          {confirm ? "Confirm delete photo" : "Remove photo"}
        </button>
        {confirm && (
          <button className="text-button" onClick={() => setConfirm(false)}>
            Keep photo
          </button>
        )}
      </div>
    </article>
  );
}

export default function Profile({
  store,
  updateStore,
  notify,
  onExplore,
  onSetup,
  signedIn,
}) {
  const [draft, setDraft] = useState(store.profile);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [importType, setImportType] = useState("Kayaking");
  const [session, setSession] = useState({
    name: "",
    date: localDate(),
    distance: "",
    hours: "",
    type: "Kayaking",
  });
  const [deleteId, setDeleteId] = useState(null);
  const activityInput = useRef(null),
    photoInput = useRef(null);
  const stats = summarizeActivities(store.activities);
  const field = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const run = async (action) => {
    try {
      await action();
    } catch {
      notify(
        "Your changes could not be saved. Check browser storage and try again.",
        "error",
      );
    }
  };

  async function importFiles(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setBusy(true);
    const imports = [],
      errors = [];
    for (const file of files) {
      try {
        if (file.size > 15 * 1024 * 1024)
          throw new Error("The file exceeds 15 MB.");
        const activities = parseActivityFile(
          await file.text(),
          file.name,
          importType,
        );
        if (!activities.length)
          throw new Error("No activities found in this file.");
        imports.push(...activities);
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    try {
      let added = 0;
      if (imports.length)
        await updateStore((current) => {
          const ids = new Set(
            current.activities.map((activity) => activity.id),
          );
          const unique = imports.filter((activity) => {
            if (ids.has(activity.id)) return false;
            ids.add(activity.id);
            return true;
          });
          added = unique.length;
          return {
            ...current,
            activities: [...unique, ...current.activities].sort((a, b) =>
              (b.date || "").localeCompare(a.date || ""),
            ),
          };
        });
      notify(
        `${added} ${added === 1 ? "session" : "sessions"} added.${imports.length > added ? ` ${imports.length - added} duplicates skipped.` : ""}${errors.length ? ` ${errors.join(" ")}` : ""}`,
        errors.length ? "error" : "success",
      );
    } catch {
      notify(
        "The import could not be saved. Check available browser storage and try again.",
        "error",
      );
    }
    setBusy(false);
  }
  async function importPhotos(event) {
    const files = [...event.target.files];
    event.target.value = "";
    setBusy(true);
    const photos = [],
      errors = [];
    for (const file of files.slice(0, 12)) {
      try {
        photos.push(await preparePhoto(file));
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    if (files.length > 12) errors.push("Choose up to 12 photos at a time.");
    try {
      if (photos.length)
        await updateStore((current) => ({
          ...current,
          photos: [...photos, ...current.photos],
        }));
      notify(
        `${photos.length} photos added.${errors.length ? ` ${errors.join(" ")}` : ""}`,
        errors.length ? "error" : "success",
      );
    } catch {
      notify(
        "Photos could not be saved. Free some browser storage and try again.",
        "error",
      );
    }
    setBusy(false);
  }
  function exportProfile() {
    download(
      JSON.stringify(
        {
          profile: store.profile,
          activities: store.activities,
          photoNotes: store.photos.map(({ blob, ...photo }) => photo),
          exportedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "solvaa-profile.json",
    );
    notify("Profile and sessions exported. Photo files stay in this browser.");
  }

  return (
    <main className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">
          {store.profile.name ? (
            store.profile.name.slice(0, 1).toUpperCase()
          ) : (
            <UserRound size={30} />
          )}
        </div>
        <div>
          <h1>
            {store.profile.name
              ? `${store.profile.name}’s paddling profile`
              : "Your story on the water"}
          </h1>
          <p>A little experience goes a long way. Keep yours in one place.</p>
        </div>
        <span className="guest-badge">
          <Check size={14} /> {signedIn ? "Account profile" : "Device profile"}
        </span>
      </div>
      <div className="profile-layout">
        <div className="profile-main">
          <section className="profile-section">
            <div className="section-title">
              <h2>Your paddling profile</h2>
              <button className="text-button" onClick={onSetup}>
                Update home & experience
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                run(async () => {
                  await updateStore((current) => ({
                    ...current,
                    profile: {
                      ...draft,
                      name: draft.name.trim(),
                      dailyDistanceKm: Number(draft.dailyDistanceKm),
                      paceKmh: Number(draft.paceKmh),
                    },
                  }));
                  notify(
                    "Profile saved. New route searches will use these preferences.",
                  );
                });
              }}
            >
              <div className="form-grid">
                <label>
                  Your name
                  <input
                    maxLength={80}
                    value={draft.name}
                    placeholder="What should we call you?"
                    onChange={(event) => field("name", event.target.value)}
                  />
                </label>
                <label>
                  Home town or area
                  <input
                    maxLength={100}
                    value={draft.home}
                    placeholder="A place or region"
                    readOnly
                    onClick={onSetup}
                  />
                  <button
                    className="text-button"
                    type="button"
                    onClick={onSetup}
                  >
                    Change home area
                  </button>
                </label>
                <label>
                  Experience
                  <select
                    value={draft.level}
                    onChange={(event) => field("level", event.target.value)}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
                <label>
                  Comfortable daily distance (km)
                  <input
                    type="number"
                    min="1"
                    max="80"
                    required
                    value={draft.dailyDistanceKm}
                    onChange={(event) =>
                      field("dailyDistanceKm", event.target.value)
                    }
                  />
                </label>
                <label>
                  Paddling pace (km/h)
                  <input
                    type="number"
                    min="2.5"
                    max="5"
                    step="0.1"
                    required
                    value={draft.paceKmh}
                    onChange={(event) => field("paceKmh", event.target.value)}
                  />
                </label>
                <label>
                  About your paddling
                  <input
                    maxLength={240}
                    value={draft.bio}
                    placeholder="Sea lochs, slow mornings, a good coffee…"
                    onChange={(event) => field("bio", event.target.value)}
                  />
                </label>
              </div>
              <fieldset className="skills-fieldset">
                <legend>Skills you feel confident in</legend>
                <p className="helper">
                  Self-assessed. Photos and distance alone cannot confirm
                  technical skills.
                </p>
                <div className="skill-options">
                  {SKILLS.map((skill) => (
                    <label key={skill}>
                      <input
                        type="checkbox"
                        checked={draft.skills.includes(skill)}
                        onChange={(event) =>
                          field(
                            "skills",
                            event.target.checked
                              ? [...draft.skills, skill]
                              : draft.skills.filter((value) => value !== skill),
                          )
                        }
                      />
                      <span>{skill}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="primary-button" type="submit">
                <Check size={17} />
                Save profile
              </button>
            </form>
          </section>
          <section className="profile-section">
            <div className="section-title">
              <h2>Your sessions</h2>
              <span>{store.activities.length} recorded</span>
            </div>
            <p>
              Bring your Strava or GPS history along. Imported paddling sessions
              help you understand your distance, time and pace.
            </p>
            <div className="import-box">
              <FileUp size={29} />
              <div>
                <h3>Bring in your activities</h3>
                <p>GPX, TCX or Strava activities.csv · up to 15 MB per file</p>
                <label className="import-type">
                  Unlabelled GPS tracks are
                  <select
                    value={importType}
                    onChange={(event) => setImportType(event.target.value)}
                  >
                    <option>Kayaking</option>
                    <option>Canoeing</option>
                    <option>StandUpPaddling</option>
                    <option>Other</option>
                  </select>
                </label>
                <p className="helper">
                  CSV imports use their own sport labels. The summary Distance
                  column must be in kilometres; detailed and “Distance (m)”
                  columns use metres.
                </p>
              </div>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => activityInput.current.click()}
              >
                <Upload size={16} />
                {busy ? "Importing…" : "Import sessions"}
              </button>
              <input
                ref={activityInput}
                hidden
                type="file"
                accept=".gpx,.tcx,.csv"
                multiple
                onChange={importFiles}
              />
            </div>
            <div className="import-links">
              <a
                href="https://support.strava.com/hc/en-us/articles/216918437-Exporting-your-Data-and-Bulk-Export"
                target="_blank"
                rel="noreferrer"
              >
                How to export from Strava <ArrowUpRight size={14} />
              </a>
              <button
                className="text-button"
                onClick={() => setManual(!manual)}
              >
                <Plus size={15} />
                {manual ? "Close manual entry" : "Log a session manually"}
              </button>
            </div>
            {manual && (
              <form
                className="manual-session"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(async () => {
                    const item = {
                      id: crypto.randomUUID(),
                      name: session.name.trim(),
                      date: `${session.date}T12:00:00Z`,
                      distanceKm: Number(session.distance),
                      durationSeconds: Number(session.hours) * 3600,
                      type: session.type,
                      isPaddling: true,
                      source: "manual",
                      track: [],
                    };
                    await updateStore((current) => ({
                      ...current,
                      activities: [item, ...current.activities],
                    }));
                    setManual(false);
                    setSession({
                      ...session,
                      name: "",
                      distance: "",
                      hours: "",
                    });
                    notify("Session added to your profile.");
                  });
                }}
              >
                <div className="form-grid">
                  <label>
                    Session name
                    <input
                      required
                      maxLength={120}
                      value={session.name}
                      onChange={(event) =>
                        setSession({ ...session, name: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      required
                      max={localDate()}
                      value={session.date}
                      onChange={(event) =>
                        setSession({ ...session, date: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Distance (km)
                    <input
                      type="number"
                      min="0.1"
                      max="300"
                      step="0.1"
                      required
                      value={session.distance}
                      onChange={(event) =>
                        setSession({ ...session, distance: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Time (hours)
                    <input
                      type="number"
                      min="0.1"
                      max="48"
                      step="0.1"
                      required
                      value={session.hours}
                      onChange={(event) =>
                        setSession({ ...session, hours: event.target.value })
                      }
                    />
                  </label>
                </div>
                <button className="primary-button" type="submit">
                  Add session
                </button>
              </form>
            )}
            {!store.activities.length ? (
              <div className="empty-inline">
                <Waves size={24} />
                <p>
                  Your first session is the start of something.
                  <br />
                  <span>Import a recording or add one manually.</span>
                </p>
              </div>
            ) : (
              <div className="session-list">
                {store.activities.map((activity) => (
                  <article className="session-row" key={activity.id}>
                    <span className="session-icon">
                      <Waves size={20} />
                    </span>
                    <div>
                      <h3>{activity.name}</h3>
                      <p>
                        {activity.date
                          ? new Date(activity.date).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "Undated"}{" "}
                        · {activity.type}
                        {!activity.isPaddling &&
                          " · excluded from paddling stats"}
                      </p>
                    </div>
                    <div className="session-stats">
                      <strong>{activity.distanceKm.toFixed(1)} km</strong>
                      <span>
                        {formatHours(activity.durationSeconds / 3600)}
                      </span>
                    </div>
                    <button
                      className="icon-button danger"
                      aria-label={
                        deleteId === activity.id
                          ? `Confirm delete ${activity.name}`
                          : `Delete ${activity.name}`
                      }
                      onClick={() =>
                        deleteId === activity.id
                          ? run(async () => {
                              await updateStore((current) => ({
                                ...current,
                                activities: current.activities.filter(
                                  (item) => item.id !== activity.id,
                                ),
                              }));
                              setDeleteId(null);
                            })
                          : setDeleteId(activity.id)
                      }
                    >
                      {deleteId === activity.id ? (
                        <Check size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="profile-section">
            <div className="section-title">
              <h2>Moments & milestones</h2>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => photoInput.current.click()}
              >
                <ImagePlus size={17} />
                Add photos
              </button>
            </div>
            <p>
              Save photos from your paddles and connect them to the skills you
              practised.
            </p>
            <input
              ref={photoInput}
              hidden
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={importPhotos}
            />
            {store.photos.length ? (
              <div className="evidence-grid">
                {store.photos.map((photo) => (
                  <PhotoEntry
                    key={photo.id}
                    photo={photo}
                    update={(updated) =>
                      run(() =>
                        updateStore((current) => ({
                          ...current,
                          photos: current.photos.map((item) =>
                            item.id === photo.id
                              ? { ...item, ...updated }
                              : item,
                          ),
                        })),
                      )
                    }
                    remove={() =>
                      run(() =>
                        updateStore((current) => ({
                          ...current,
                          photos: current.photos.filter(
                            (item) => item.id !== photo.id,
                          ),
                        })),
                      )
                    }
                  />
                ))}
              </div>
            ) : (
              <button
                className="photo-dropzone"
                disabled={busy}
                onClick={() => photoInput.current.click()}
              >
                <ImagePlus size={30} />
                <strong>Add a photo from the water</strong>
                <span>JPEG, PNG or WebP · up to 12 MB each</span>
              </button>
            )}
          </section>
        </div>
        <aside className="profile-sidebar">
          <section className="profile-stats">
            <h2>Your time on the water</h2>
            <div className="profile-stat">
              <Waves size={19} />
              <strong>{stats.count}</strong>
              <span>paddling sessions</span>
            </div>
            <div className="profile-stat">
              <Route size={19} />
              <strong>
                {stats.distanceKm.toFixed(1)} <small>km</small>
              </strong>
              <span>distance paddled</span>
            </div>
            <div className="profile-stat">
              <Clock3 size={19} />
              <strong>{formatHours(stats.durationSeconds / 3600)}</strong>
              <span>recorded time</span>
            </div>
            <p className="helper">{stats.suggestion}</p>
            {stats.paceKmh && (
              <div className="pace-suggestion">
                <strong>{stats.paceKmh} km/h</strong>
                <p>
                  Average recorded pace, including any pauses in GPS tracks.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    field("paceKmh", Math.max(2.5, Math.min(5, stats.paceKmh)));
                    notify(
                      "Pace filled in. Save your profile to use it in route estimates.",
                    );
                  }}
                >
                  Use for planning <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            <button className="primary-button" onClick={onExplore}>
              Find your next paddle
              <ArrowUpRight size={17} />
            </button>
          </section>
          <section className="privacy-note">
            <ShieldCheck size={23} />
            <h3>Your own little logbook</h3>
            <p>
              Your profile, sessions, photos and trips are saved in this browser
              on this device.{" "}
              {signedIn
                ? "Your profile and saved trips sync to your account."
                : "Sign in for a separate profile and trip workspace that syncs across devices."}
            </p>
            <p>
              Clearing browser data will remove them. Photo location metadata is
              stripped before saving.
            </p>
            <button className="text-button" onClick={exportProfile}>
              <Download size={15} />
              Export profile & sessions
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}
