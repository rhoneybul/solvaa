import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  Mountain,
  Plus,
  Trash2,
  UserRound,
  Waves,
  X,
} from "lucide-react";
import Account from "./components/Account.jsx";
import Onboarding from "./components/Onboarding.jsx";
import MapPlanner, { RouteTrace } from "./components/MapPlanner.jsx";
import { useAuth } from "./lib/AuthContext.jsx";
import { cloudPayload, reconcileWorkspace } from "./lib/workspace.mjs";
import {
  download,
  INITIAL_STATE,
  loadState,
  saveState,
} from "./lib/storage.mjs";
import { homeRegion, newDraft } from "./lib/plotting.mjs";
import { formatHours } from "./lib/geo.mjs";
const Profile = lazy(() => import("./components/Profile.jsx"));
const pageFromHash = () =>
  ["trips", "profile", "account"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "explore";
function Brand() {
  return (
    <a className="brand" href="#explore" aria-label="Solvaa home">
      <span className="brand-mark">
        <Mountain size={24} />
        <span />
      </span>
      solvaa<span className="brand-dot">.</span>
    </a>
  );
}
export default function App() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <main className="loading-page" role="status">
        <Waves size={32} />
        <p>Opening Solvaa…</p>
      </main>
    );
  const required = auth.config?.authRequired ?? !import.meta.env.DEV;
  if (required && !auth.user)
    return (
      <div className="auth-shell">
        <header className="site-header">
          <Brand />
          <span className="auth-tagline">A good day starts on the water.</span>
        </header>
        <Account
          required
          onContinue={() => {
            location.hash = "explore";
          }}
        />
      </div>
    );
  return <Workspace key={auth.user?.id || "guest"} auth={auth} />;
}
function SavedRoutes({ plans, open, remove, onExplore, signedIn }) {
  const [confirm, setConfirm] = useState(null);
  return (
    <main className="trips-page">
      <div className="page-heading">
        <div>
          <h1>Your next good days.</h1>
          <p>Every route you’ve made, ready to come back to.</p>
        </div>
        <button className="primary-button" onClick={onExplore}>
          <Plus size={17} />
          Plot a route
        </button>
      </div>
      {!plans.length ? (
        <div className="trips-empty">
          <Bookmark size={38} />
          <h2>A place for your first paddle.</h2>
          <p>Choose a launch, draw your line, and save it here.</p>
          <button className="primary-button" onClick={onExplore}>
            Explore the map
            <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <div className="saved-trip-list">
          {plans.map((plan) => (
            <article className="saved-trip" key={plan.id}>
              <RouteTrace plan={plan} />
              <div className="saved-trip-content">
                <h2>{plan.title}</h2>
                <span className="saved-kind">
                  {plan.kind === "plotted"
                    ? `${plan.days.length} ${plan.days.length === 1 ? "day" : "days"} · ${plan.region.name}`
                    : "Earlier planning outline"}
                </span>
                <p>
                  {plan.startDate || plan.request?.startDate} ·{" "}
                  {plan.totalDistanceKm ?? plan.routes?.[0]?.distanceKm ?? 0} km
                  ·{" "}
                  {formatHours(
                    plan.totalHours ?? plan.routes?.[0]?.durationHours ?? 0,
                  )}
                </p>
              </div>
              <button className="secondary-button" onClick={() => open(plan)}>
                Open route
                <ArrowRight size={16} />
              </button>
              <button
                className="icon-button danger"
                aria-label={
                  confirm === plan.id
                    ? `Confirm delete ${plan.title}`
                    : `Delete ${plan.title}`
                }
                onClick={() =>
                  confirm === plan.id ? remove(plan.id) : setConfirm(plan.id)
                }
              >
                {confirm === plan.id ? (
                  <Check size={18} />
                ) : (
                  <Trash2 size={18} />
                )}
              </button>
            </article>
          ))}
        </div>
      )}
      <p className="local-data-note">
        {signedIn
          ? "Saved routes sync to your account. Drafts and session files stay on this device."
          : "Local development preview. Saved routes stay on this device."}
      </p>
    </main>
  );
}
function Workspace({ auth }) {
  const account = auth.user?.id || "guest";
  const authRef = useRef(auth);
  authRef.current = auth;
  const cloudRevision = useRef(0),
    cloudReady = useRef(false);
  const [syncError, setSyncError] = useState("");
  const [onboarding, setOnboarding] = useState(false);
  const [store, setStore] = useState(() => structuredClone(INITIAL_STATE));
  const storeRef = useRef(store),
    saveQueue = useRef(Promise.resolve());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState(pageFromHash);
  const [notice, setNotice] = useState(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [legacy, setLegacy] = useState(null);
  const notify = useCallback(
    (message, kind = "success") => setNotice({ message, kind }),
    [],
  );

  useEffect(() => {
    let active = true;
    async function openWorkspace() {
      let data = await loadState(account);
      if (authRef.current.user) {
        try {
          const remote = await authRef.current.accountApi(
            "/api/account/workspace",
            { userId: account },
          );
          const resolved = reconcileWorkspace(data, remote);
          data = resolved.state;
          cloudRevision.current = resolved.revision;
          cloudReady.current = !resolved.conflict;
          if (resolved.conflict && active)
            setSyncError(
              "This device has unsynced changes and your account changed elsewhere. Download a backup before choosing which version to keep.",
            );
          if (resolved.pending) {
            const saved = await authRef.current.accountApi(
              "/api/account/workspace",
              {
                userId: account,
                method: "PUT",
                body: JSON.stringify({
                  payload: cloudPayload(data),
                  revision: cloudRevision.current,
                }),
              },
            );
            cloudRevision.current = saved.revision;
            data = {
              ...data,
              cloudPending: false,
              cloudRevision: saved.revision,
            };
          }
          await saveState(data, account);
        } catch {
          cloudReady.current = false;
          if (active)
            setSyncError(
              "Account sync is unavailable. Changes stay on this device until you reload and reconnect.",
            );
        }
      }
      if (!active) return;
      storeRef.current = data;
      setStore(data);
      setOnboarding(
        !data.profile.onboardingComplete && !data.profile.onboardingDismissed,
      );
      setLoaded(true);
    }
    openWorkspace().catch(() => {
      if (active) {
        setLoaded(true);
        notify(
          "Browser storage is unavailable. Changes cannot be saved until storage is enabled.",
          "error",
        );
      }
    });
    const handler = () => setTab(pageFromHash());
    window.addEventListener("hashchange", handler);
    return () => {
      active = false;
      window.removeEventListener("hashchange", handler);
    };
  }, [notify, account]);
  useEffect(() => {
    if (auth.recovery) {
      location.hash = "account";
      setTab("account");
    }
  }, [auth.recovery]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);
  function navigate(value) {
    location.hash = value === "explore" ? "explore" : value;
    setTab(value);
    window.scrollTo({ top: 0 });
  }
  const updateStore = useCallback(
    (mutator) => {
      const previous = storeRef.current;
      const changed = mutator(previous);
      const needsSync =
        account !== "guest" &&
        JSON.stringify(cloudPayload(changed)) !==
          JSON.stringify(cloudPayload(previous));
      const next = {
        ...changed,
        cloudPending: changed.cloudPending || needsSync,
      };
      storeRef.current = next;
      setStore(next);
      const operation = saveQueue.current
        .catch(() => {})
        .then(async () => {
          await saveState(
            { ...next, cloudRevision: cloudRevision.current },
            account,
          );
          if (!needsSync) return;
          if (!cloudReady.current) {
            setSyncError(
              "Saved on this device. Account sync is paused; reconnect before expecting these changes on other devices.",
            );
            return;
          }
          try {
            const result = await authRef.current.accountApi(
              "/api/account/workspace",
              {
                userId: account,
                method: "PUT",
                body: JSON.stringify({
                  payload: cloudPayload(next),
                  revision: cloudRevision.current,
                }),
              },
            );
            cloudRevision.current = result.revision;
            await saveState(
              { ...next, cloudPending: false, cloudRevision: result.revision },
              account,
            );
            if (storeRef.current === next) {
              const synced = {
                ...next,
                cloudPending: false,
                cloudRevision: result.revision,
              };
              storeRef.current = synced;
              setStore(synced);
            }
            setSyncError("");
          } catch (error) {
            cloudReady.current = false;
            setSyncError(`Saved on this device. ${error.message}`);
          }
        });
      saveQueue.current = operation;
      return operation;
    },
    [account],
  );

  async function finishOnboarding({ profile, photo, session }) {
    await updateStore((current) => ({
      ...current,
      profile,
      draft: current.draft || newDraft(homeRegion(profile)),
      photos: photo ? [photo, ...current.photos] : current.photos,
      activities: session
        ? [session, ...current.activities]
        : current.activities,
    }));
    setOnboarding(false);
    navigate("explore");
    notify(
      `You’re set${profile.name ? ", " + profile.name : ""}. Let’s find your first launch.`,
    );
  }
  async function savePlan(plan) {
    const first = !storeRef.current.profile.firstRouteSavedAt;
    await updateStore((current) => ({
      ...current,
      draft: plan,
      profile: {
        ...current.profile,
        firstRouteSavedAt:
          current.profile.firstRouteSavedAt || new Date().toISOString(),
      },
      plans: [plan, ...current.plans.filter((item) => item.id !== plan.id)],
    }));
    return {
      first,
      synced:
        !!auth.user && cloudReady.current && !storeRef.current.cloudPending,
    };
  }
  async function startNew() {
    const current = storeRef.current;
    const draft = current.draft;
    if (
      draft?.days.some(
        (d) => d.points.length || d.stops.length || d.notes.trim(),
      ) &&
      JSON.stringify(draft) !==
        JSON.stringify(current.plans.find((p) => p.id === draft.id)) &&
      !window.confirm(
        "Start a new route? Your current unsaved draft will be replaced.",
      )
    )
      return;
    await updateStore((value) => ({
      ...value,
      draft: newDraft(homeRegion(value.profile)),
    }));
    setEditorVersion((v) => v + 1);
    setLegacy(null);
    navigate("explore");
  }
  async function openPlan(plan) {
    if (plan.kind !== "plotted") {
      setLegacy(plan);
      return;
    }
    const draft = storeRef.current.draft;
    if (
      draft &&
      draft.id !== plan.id &&
      draft.days.some(
        (d) => d.points.length || d.stops.length || d.notes.trim(),
      ) &&
      JSON.stringify(draft) !==
        JSON.stringify(storeRef.current.plans.find((p) => p.id === draft.id)) &&
      !window.confirm("Open this route and replace your unsaved draft?")
    )
      return;
    await updateStore((current) => ({
      ...current,
      draft: structuredClone(plan),
    }));
    setEditorVersion((v) => v + 1);
    navigate("explore");
  }
  return (
    <div className="app-shell map-app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          {[
            ["explore", "Explore", Compass],
            ["trips", "Saved", Bookmark],
            ["profile", "Profile", UserRound],
          ].map(([key, label, Icon]) => (
            <a
              key={key}
              href={`#${key}`}
              className={tab === key ? "active" : ""}
              aria-current={tab === key ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <button
          className="account-control"
          aria-label={auth.user ? "Your account" : "Sign in"}
          onClick={() => navigate("account")}
        >
          <span>
            {store.profile.name?.slice(0, 1).toUpperCase() || (
              <UserRound size={18} />
            )}
          </span>
        </button>
      </header>
      {notice && (
        <div
          className={`toast ${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.kind === "success" && <Check size={17} />}
          <span>{notice.message}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice(null)}>
            <X size={18} />
          </button>
        </div>
      )}
      {syncError && (
        <div className="sync-banner" role="status">
          <p>{syncError}</p>
          <button
            className="text-button"
            onClick={() =>
              download(
                JSON.stringify(
                  {
                    profile: store.profile,
                    plans: store.plans,
                    activities: store.activities,
                  },
                  null,
                  2,
                ),
                "solvaa-device-backup.json",
              )
            }
          >
            Download device backup
          </button>
          <button
            className="text-button"
            onClick={async () => {
              if (
                !window.confirm(
                  "Replace this device’s profile and saved routes with your account version? Download a backup first to keep unsynced changes.",
                )
              )
                return;
              try {
                await saveQueue.current.catch(() => {});
                const remote = await authRef.current.accountApi(
                  "/api/account/workspace",
                  { userId: account },
                );
                if (!remote.payload)
                  throw new Error(
                    "There is no account copy yet. Reload to retry syncing.",
                  );
                await saveState(
                  {
                    ...storeRef.current,
                    ...remote.payload,
                    cloudPending: false,
                    cloudRevision: remote.revision,
                  },
                  account,
                );
                location.reload();
              } catch (e) {
                setSyncError(e.message);
              }
            }}
          >
            Use account version
          </button>
        </div>
      )}
      {!loaded ? (
        <main className="loading-page" role="status">
          Opening your map…
        </main>
      ) : (
        <div id="main-content" tabIndex={-1}>
          {tab === "account" ? (
            <Account onContinue={() => navigate("explore")} />
          ) : onboarding ? (
            <Onboarding
              profile={store.profile}
              onFinish={finishOnboarding}
              onSkip={async () => {
                await updateStore((current) => ({
                  ...current,
                  profile: { ...current.profile, onboardingDismissed: true },
                }));
                setOnboarding(false);
              }}
              onAccount={() => navigate("account")}
            />
          ) : tab === "profile" ? (
            <Suspense
              fallback={
                <main className="loading-page">Opening your profile…</main>
              }
            >
              <Profile
                store={store}
                signedIn={!!auth.user}
                onSetup={() => setOnboarding(true)}
                updateStore={updateStore}
                notify={notify}
                onExplore={() => navigate("explore")}
              />
            </Suspense>
          ) : tab === "trips" ? (
            <>
              <SavedRoutes
                plans={store.plans}
                signedIn={!!auth.user}
                open={(plan) =>
                  openPlan(plan).catch((e) => notify(e.message, "error"))
                }
                remove={(id) =>
                  updateStore((current) => ({
                    ...current,
                    plans: current.plans.filter((p) => p.id !== id),
                  })).catch((e) => notify(e.message, "error"))
                }
                onExplore={() =>
                  startNew().catch((e) => notify(e.message, "error"))
                }
              />
              {legacy && (
                <section className="legacy-plan">
                  <button
                    className="text-button"
                    onClick={() => setLegacy(null)}
                  >
                    Close outline
                    <X size={16} />
                  </button>
                  <h2>{legacy.title}</h2>
                  <p>
                    This earlier plan used unvalidated route outlines. Its notes
                    are kept below; plot a new route on the map to choose each
                    leg yourself.
                  </p>
                  {legacy.days?.length ? (
                    legacy.days.map((day, i) => (
                      <div key={i}>
                        <h3>
                          Day {i + 1}: {day.route?.name}
                        </h3>
                        <p>{day.notes || "No notes saved."}</p>
                        {Object.entries(day.stops || {}).map(([key, value]) => (
                          <p key={key}>
                            {key}:{" "}
                            {typeof value === "string"
                              ? value
                              : JSON.stringify(value)}
                          </p>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p>{legacy.routes?.map((r) => r.name).join(", ")}</p>
                  )}
                  <button
                    className="primary-button"
                    onClick={() =>
                      startNew().catch((e) => notify(e.message, "error"))
                    }
                  >
                    Plot a new route
                  </button>
                </section>
              )}
            </>
          ) : (
            <MapPlanner
              key={editorVersion}
              initialDraft={store.draft}
              profile={store.profile}
              onDraft={(draft) =>
                updateStore((current) => ({ ...current, draft }))
              }
              onSave={savePlan}
              onSavedRoutes={() => navigate("trips")}
              onSetHome={() => setOnboarding(true)}
              onNew={() => startNew().catch((e) => notify(e.message, "error"))}
            />
          )}
        </div>
      )}
    </div>
  );
}
