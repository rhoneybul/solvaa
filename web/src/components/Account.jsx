import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LogOut,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../lib/AuthContext.jsx";

export default function Account({ onContinue, required = false }) {
  const auth = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const recovery = auth.recovery;
  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const redirectTo = `${location.origin}/#account`;
      let result;
      if (recovery) result = await auth.client.auth.updateUser({ password });
      else if (mode === "signup")
        result = await auth.client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
      else if (mode === "reset")
        result = await auth.client.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
      else
        result = await auth.client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setPassword("");
      if (recovery) {
        auth.finishRecovery();
        setMessage("Your password has been updated.");
      } else if (mode === "signup" && !result.data.session)
        setMessage(
          "Check your email to confirm your account, then sign in here.",
        );
      else if (mode === "reset")
        setMessage(
          "If this email has an account, a password reset link is on its way.",
        );
      else onContinue();
    } catch (err) {
      setError(err.message || "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="account-page">
      <section className="account-sheet">
        {!required && (
          <button className="back-button" onClick={onContinue}>
            <ArrowLeft size={17} />
            Back to exploring
          </button>
        )}
        <h1>
          {recovery
            ? "Choose a new password"
            : auth.user
              ? "Your account"
              : mode === "signup"
                ? "Your next paddle starts here."
                : mode === "reset"
                  ? "Let’s get you back in."
                  : "A little closer to the water."}
        </h1>
        <p className="account-intro">
          {auth.user && !recovery
            ? "Your paddling profile and saved trips stay with your account."
            : "Save your profile and trips across devices. Email and password are all you need."}
        </p>
        {!auth.client ? (
          <>
            <p className="note">
              {auth.error ||
                (required
                  ? "Sign-in is being configured. Please try again shortly."
                  : "Sign-in is not configured in this local preview.")}
            </p>
            {!required && (
              <button className="primary-button" onClick={onContinue}>
                Continue local preview
                <ArrowRight size={18} />
              </button>
            )}
            {required && (
              <button
                className="secondary-button"
                onClick={() => location.reload()}
              >
                Try again
              </button>
            )}
          </>
        ) : auth.user && !recovery ? (
          <>
            <div className="account-identity">
              <Mail size={20} />
              <span>{auth.user.email}</span>
            </div>
            {!auth.user.email_confirmed_at && (
              <p className="note">
                Confirm your email before using optional AI features.
              </p>
            )}
            <p className="helper">
              Photos and imported session files stay on this device. Your
              profile and saved trips sync to your account.
            </p>
            <button className="primary-button" onClick={onContinue}>
              Find a paddle
              <ArrowRight size={18} />
            </button>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await auth.client.auth.signOut({
                  scope: "local",
                });
                if (error) setError(error.message);
                setBusy(false);
              }}
            >
              <LogOut size={17} />
              Sign out of this device
            </button>
          </>
        ) : (
          <>
            {!recovery && mode !== "reset" && (
              <div className="account-tabs">
                <button
                  aria-pressed={mode === "login"}
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setMessage("");
                  }}
                >
                  Sign in
                </button>
                <button
                  aria-pressed={mode === "signup"}
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setMessage("");
                  }}
                >
                  Create account
                </button>
              </div>
            )}
            <form onSubmit={submit} className="account-form">
              {!recovery && (
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {(recovery || mode !== "reset") && (
                <label>
                  {recovery ? "New password" : "Password"}
                  <input
                    type="password"
                    autoComplete={
                      mode === "signup" || recovery
                        ? "new-password"
                        : "current-password"
                    }
                    required
                    minLength={mode === "signup" || recovery ? 12 : 1}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  {(mode === "signup" || recovery) && (
                    <span className="helper">Use at least 12 characters.</span>
                  )}
                </label>
              )}
              <button className="primary-button" disabled={busy}>
                {busy
                  ? "One moment…"
                  : recovery
                    ? "Update password"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "reset"
                        ? "Send reset link"
                        : "Sign in"}
                <ArrowRight size={18} />
              </button>
            </form>
            {!recovery && (
              <button
                className="text-button"
                onClick={() => {
                  setMode(mode === "reset" ? "login" : "reset");
                  setMessage("");
                  setError("");
                }}
              >
                {mode === "reset" ? "Back to sign in" : "Forgot your password?"}
              </button>
            )}
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="account-success" role="status">
            <Check size={18} />
            {message}
          </p>
        )}
        <p className="account-footer">
          <ShieldCheck size={17} />
          No Google account required.
        </p>
      </section>
    </main>
  );
}
