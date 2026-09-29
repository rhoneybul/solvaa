import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  LocateFixed,
  MapPin,
  Upload,
  Waves,
} from "lucide-react";
import HomeMap from "./HomeMap.jsx";
import { api } from "../lib/api.mjs";
import { useAuth } from "../lib/AuthContext.jsx";
import { assessExperience, prepareScreenshot } from "../lib/onboarding.mjs";
import { preparePhoto } from "../lib/storage.mjs";

const AREAS = [
  { name: "Portree, Isle of Skye", lat: 57.412, lon: -6.195 },
  { name: "Aviemore, Cairngorms", lat: 57.189, lon: -3.83 },
  { name: "Keswick, Lake District", lat: 54.6, lon: -3.137 },
  { name: "Luss, Loch Lomond", lat: 56.1, lon: -4.64 },
];
export default function Onboarding({ profile, onFinish, onSkip, onAccount }) {
  const auth = useAuth();
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [name, setName] = useState(profile.name),
    [home, setHome] = useState(profile.home || "");
  const [place, setPlace] = useState(
    profile.homeCoords ? { name: profile.home, ...profile.homeCoords } : null,
  );
  const [places, setPlaces] = useState([]),
    [searched, setSearched] = useState(false);
  const [frequency, setFrequency] = useState(
    profile.experience?.frequency || "new",
  );
  const [water, setWater] = useState(profile.experience?.water || "sheltered");
  const [rescue, setRescue] = useState(
    profile.skills.includes("Self rescue") ||
      profile.skills.includes("Assisted rescue"),
  );
  const [navigation, setNavigation] = useState(
    profile.skills.includes("Coastal navigation"),
  );
  const [distance, setDistance] = useState(""),
    [minutes, setMinutes] = useState("");
  const [screenshot, setScreenshot] = useState(null),
    [reading, setReading] = useState("");
  const [level, setLevel] = useState(profile.level),
    [daily, setDaily] = useState(profile.dailyDistanceKm);
  const radius = profile.travelRadiusKm || 75;
  const [customLevel, setCustomLevel] = useState(false);
  const [consent, setConsent] = useState(false);
  const fileInput = useRef(null),
    heading = useRef(null),
    mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);
  const assessment = assessExperience({ frequency, water, rescue, navigation });
  useEffect(() => {
    if (!customLevel) setLevel(assessment.level);
  }, [assessment.level, customLevel]);
  async function work(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(e.message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function searchPlace() {
    await work(async () => {
      const result = await (auth.user ? auth.accountApi : api)(
        `/api/onboarding/locations?q=${encodeURIComponent(home)}`,
      );
      setPlaces(result.places);
      setSearched(true);
    });
  }
  function choosePlace(value) {
    setPlace(value);
    setHome(value.name);
    setPlaces([]);
    setSearched(false);
  }
  function locate() {
    if (!navigator.geolocation) {
      setError("Location is unavailable. Search for a town or choose an area.");
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!mounted.current) return;
        const selected = {
          name: home.trim() || "My home area",
          lat: Number(position.coords.latitude.toFixed(2)),
          lon: Number(position.coords.longitude.toFixed(2)),
        };
        choosePlace(selected);
        setBusy(false);
      },
      () => {
        if (mounted.current) {
          setError(
            "Location was unavailable. Search for a town or choose an area instead.",
          );
          setBusy(false);
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }
  async function addScreenshot(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    await work(async () => {
      const image = await prepareScreenshot(file);
      const photo = await preparePhoto(file);
      setScreenshot({ image, photo });
      setReading("");
      setConsent(false);
    });
  }
  async function readScreenshot() {
    await work(async () => {
      const data = await auth.accountApi("/api/onboarding/read-screenshot", {
        method: "POST",
        body: JSON.stringify({ image: screenshot.image }),
        signal: AbortSignal.timeout(25000),
      });
      if (data.sport === "Other") {
        setReading(
          "This does not look like a paddling activity. Enter details from a kayaking, canoeing or SUP session below.",
        );
        return;
      }
      setDistance(data.distanceKm ?? "");
      setMinutes(data.durationMinutes ?? "");
      setReading(
        "Check these figures against your screenshot, then correct anything that looks wrong.",
      );
    });
  }
  function next(e) {
    e.preventDefault();
    setError("");
    if (step === 0 && !place) {
      setError(
        "Choose your town from the results, use your location, or select an area below.",
      );
      return;
    }
    setStep(step + 1);
  }
  async function finish(e) {
    e.preventDefault();
    await work(async () => {
      const skills = [
        ...profile.skills.filter(
          (skill) =>
            !["Self rescue", "Assisted rescue", "Coastal navigation"].includes(
              skill,
            ),
        ),
        ...(rescue ? ["Self rescue"] : []),
        ...(navigation ? ["Coastal navigation"] : []),
      ];
      const pace =
        Number(distance) > 0 && Number(minutes) > 0
          ? Math.min(
              5,
              Math.max(2.5, Number(distance) / (Number(minutes) / 60)),
            )
          : profile.paceKmh;
      await onFinish({
        profile: {
          ...profile,
          name: name.trim(),
          home: home.trim(),
          homeCoords: { lat: place.lat, lon: place.lon },
          travelRadiusKm: Number(radius),
          level,
          dailyDistanceKm: Number(daily),
          paceKmh: Math.round(pace * 10) / 10,
          skills,
          experience: { frequency, water },
          onboardingComplete: true,
          onboardingDismissed: false,
        },
        photo: screenshot?.photo,
        session:
          Number(distance) > 0 && Number(minutes) > 0
            ? {
                id: crypto.randomUUID(),
                name: "My recent paddle",
                type: "Kayaking",
                isPaddling: true,
                distanceKm: Number(distance),
                durationSeconds: Number(minutes) * 60,
                source: "Self-reported onboarding",
                date: null,
                track: [],
              }
            : null,
      });
    });
  }
  return (
    <main className="onboarding-page">
      <section className="onboarding-sheet">
        <div className="onboarding-top">
          <button
            className="text-button"
            disabled={busy}
            onClick={() => work(onSkip)}
          >
            Skip for now
          </button>
        </div>
        <ol className="onboarding-progress" aria-label="Setup progress">
          {["Home", "Experience"].map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? "step" : undefined}
              className={step >= index ? "reached" : ""}
            >
              <span>{index < step ? <Check size={13} /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <h1 ref={heading} tabIndex={-1}>
          {
            [
              "Good days start close to home.",
              "Tell us about your time on the water.",
              "A starting point that fits you.",
            ][step]
          }
        </h1>
        <p className="onboarding-intro">
          {
            [
              "We’ll open the map near you. A town or approximate area is enough.",
              "A few details help set a comfortable pace. You can add a recent paddle too.",
              "Review your suggested level and comfortable distance. You can change these whenever you like.",
            ][step]
          }
        </p>
        <form onSubmit={step === 1 ? finish : next}>
          {step === 0 && (
            <div className="onboarding-fields">
              <label>
                Your name <span className="optional">Optional</span>
                <input
                  autoComplete="given-name"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </label>
              <label>
                Home town or city
                <input
                  autoComplete="address-level2"
                  maxLength={100}
                  value={home}
                  onChange={(e) => {
                    setHome(e.target.value);
                    setPlace(null);
                  }}
                  placeholder="For example, Portree"
                />
              </label>
              <div className="location-actions">
                {auth.config?.geocodingEnabled && (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy || home.trim().length < 2}
                    onClick={searchPlace}
                  >
                    <MapPin size={17} />
                    Search town
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={locate}
                >
                  <LocateFixed size={17} />
                  Use my location
                </button>
              </div>
              <p className="helper">
                Use your approximate location or choose your home area on the
                map below.
              </p>
              {places.length > 0 && (
                <ul className="place-results">
                  {places.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => choosePlace(item)}>
                        <MapPin size={17} />
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searched && !places.length && !place && (
                <p className="note">
                  No town found. Try the town and country together.
                </p>
              )}
              {place && (
                <p className="location-selected" role="status">
                  <Check size={17} />
                  {place.name}
                </p>
              )}
              <details className="plot-details">
                <summary>
                  Choose my home area on a map
                  <ChevronDown className="disclosure-chevron" size={16} />
                </summary>
                <HomeMap
                  place={place}
                  onChoose={(point) =>
                    choosePlace({
                      name: home.trim() || "My home area",
                      ...point,
                    })
                  }
                />
              </details>
              <details className="onboarding-areas">
                <summary>Or start with one of these areas</summary>
                <div>
                  {AREAS.map((item) => (
                    <button
                      className="secondary-button"
                      type="button"
                      key={item.name}
                      onClick={() => choosePlace(item)}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </details>
              <p className="helper">
                You can explore anywhere on the map. We’ll use this area as your
                starting point.
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="onboarding-fields">
              <label>
                How often do you paddle?
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="new">I’m new to paddling</option>
                  <option value="sometimes">Occasionally</option>
                  <option value="regular">Regularly</option>
                </select>
              </label>
              <label>
                Where have you paddled?
                <select
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                >
                  <option value="sheltered">
                    Sheltered lakes or calm inland water
                  </option>
                  <option value="coastal">Coastal water and sea lochs</option>
                </select>
              </label>
              <fieldset className="onboarding-confidence">
                <legend>What do you feel confident doing?</legend>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={rescue}
                    onChange={(e) => setRescue(e.target.checked)}
                  />
                  Recovering safely after a capsize
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={navigation}
                    onChange={(e) => setNavigation(e.target.checked)}
                  />
                  Planning around tides and navigating coastal water
                </label>
              </fieldset>
              <p className="helper">
                A screenshot shows a session, not technical ability. Your
                answers help us suggest a starting level; this is not a
                qualification.
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="onboarding-fields">
              <div className="assessment-result">
                <Waves size={28} />
                <div>
                  <span>Suggested starting level</span>
                  <strong>{assessment.level}</strong>
                  <p>{assessment.reason}</p>
                </div>
              </div>
              <details className="plot-details">
                <summary>
                  Adjust your starting profile
                  <ChevronDown className="disclosure-chevron" size={16} />
                </summary>
                <label>
                  Your level
                  <select
                    value={level}
                    onChange={(e) => {
                      setCustomLevel(true);
                      setLevel(e.target.value);
                    }}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </label>
                <label>
                  Comfortable distance in a day (km)
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="80"
                    step="1"
                    required
                    value={daily}
                    onChange={(e) => setDaily(e.target.value)}
                  />
                </label>
              </details>
              <details className="plot-details onboarding-evidence">
                <summary>
                  <Upload size={17} />
                  Add a recent paddle <span>Optional</span>
                  <ChevronDown className="disclosure-chevron" size={16} />
                </summary>
                <div className="screenshot-import">
                  <Upload size={23} />
                  <div>
                    <strong>A recent paddle tells a story.</strong>
                    <p>Upload a screenshot, or enter its details below.</p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => fileInput.current.click()}
                  >
                    {screenshot ? "Replace screenshot" : "Add screenshot"}
                  </button>
                  <input
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    ref={fileInput}
                    onChange={addScreenshot}
                  />
                </div>
                {screenshot && (
                  <div className="screenshot-review">
                    <img
                      src={screenshot.image}
                      alt="Your uploaded activity screenshot"
                    />
                    <div>
                      <p className="helper">
                        Stays on this device. It is only sent to the AI provider
                        if you choose to read it with AI.
                      </p>
                      {auth.user && auth.config?.aiEnabled ? (
                        <>
                          <label className="check-label">
                            <input
                              type="checkbox"
                              checked={consent}
                              onChange={(e) => setConsent(e.target.checked)}
                            />
                            Send this screenshot to Anthropic to read the
                            activity figures.
                          </label>
                          <button
                            className="secondary-button"
                            type="button"
                            disabled={
                              busy || !consent || !auth.user.email_confirmed_at
                            }
                            onClick={readScreenshot}
                          >
                            Read with AI
                          </button>
                          <p className="helper">
                            Verified email required. Up to{" "}
                            {auth.config.aiLimits.perDay} reads a day and{" "}
                            {auth.config.aiLimits.perMonth} a month, shared with
                            other AI features.
                          </p>
                        </>
                      ) : (
                        <p className="helper">
                          Enter the figures below.{" "}
                          {auth.config?.aiEnabled
                            ? "Sign in with a verified email to use optional AI reading."
                            : "Optional AI reading is currently unavailable."}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {reading && (
                  <p className="note" role="status">
                    {reading}
                  </p>
                )}
                <div className="form-grid">
                  <label>
                    Recent paddle distance (km)
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      max="200"
                      step="0.1"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      placeholder="Optional, e.g. 6"
                    />
                  </label>
                  <label>
                    Time on the water (minutes)
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="1440"
                      step="1"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      placeholder="Optional, e.g. 90"
                    />
                  </label>
                </div>
              </details>
              {!auth.user && (
                <p className="note">
                  Your profile will be saved on this device. You can sign in
                  later to create a separate account profile.
                </p>
              )}
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="onboarding-footer">
            {step > 0 && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
              >
                <ArrowLeft size={17} />
                Back
              </button>
            )}
            <button className="primary-button" disabled={busy}>
              {busy
                ? "One moment…"
                : step === 1
                  ? "Show me the map"
                  : "Continue"}
              <ArrowRight size={18} />
            </button>
          </div>
        </form>
        {step === 0 && !auth.user && (
          <button
            className="text-button onboarding-signin"
            disabled={busy}
            onClick={onAccount}
          >
            Already have an account? Sign in
          </button>
        )}
        {step === 0 && (
          <p className="location-attribution">
            Place search data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
