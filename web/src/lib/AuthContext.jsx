import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "./api.mjs";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    client: null,
    session: null,
    config: null,
    error: "",
    recovery: false,
  });
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    let active = true,
      subscription;
    async function initialize() {
      try {
        const config = await api("/api/config");
        if (!config.auth) {
          if (active) setState({ ...current.current, loading: false, config });
          return;
        }
        const { createClient } = await import("@supabase/supabase-js");
        if (!active) return;
        const client = createClient(config.auth.url, config.auth.publicKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce",
          },
        });
        subscription = client.auth.onAuthStateChange((event, next) => {
          if (active)
            setState((value) => ({
              ...value,
              client,
              config,
              session: next,
              recovery:
                event === "PASSWORD_RECOVERY" ||
                (event !== "SIGNED_OUT" && value.recovery),
            }));
        }).data.subscription;
        const {
          data: { session },
          error,
        } = await client.auth.getSession();
        if (error) throw error;
        if (!active) return;
        setState((value) => ({
          ...value,
          loading: false,
          client,
          session,
          config,
          error: "",
        }));
      } catch {
        if (active)
          setState((value) => ({
            ...value,
            loading: false,
            error:
              "Sign-in is unavailable right now. Please try again shortly.",
          }));
      }
    }
    initialize();
    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);
  async function accountApi(path, options = {}) {
    const userId = options.userId || current.current.session?.user.id;
    const session = current.current.session;
    if (!session || session.user.id !== userId)
      throw new Error("Your account changed. Please try again.");
    const { userId: ignored, ...request } = options;
    return api(path, {
      ...request,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  }
  return (
    <AuthContext.Provider
      value={{
        ...state,
        user: state.session?.user,
        accountApi,
        finishRecovery: () =>
          setState((value) => ({ ...value, recovery: false })),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
