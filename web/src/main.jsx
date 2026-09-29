import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./plot.css";
import App from "./App.jsx";
import AuthProvider from "./lib/AuthContext.jsx";

// Retire the Expo service worker, which can otherwise serve the old login shell.
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .getRegistrations()
    .then((items) =>
      items.forEach((item) => {
        if (item.active?.scriptURL === `${location.origin}/service-worker.js`)
          item.unregister();
      }),
    )
    .catch(() => {});

class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="recovery">
        <h1>Something went wrong.</h1>
        <p>Your saved trips are still in this browser. Reload to try again.</p>
        <button onClick={() => location.reload()}>Reload Solvaa</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
  </ErrorBoundary>,
);
