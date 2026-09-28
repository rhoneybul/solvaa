const base = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(18000),
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    throw new Error(
      ["AbortError", "TimeoutError"].includes(error.name)
        ? "The service took too long to respond. Please try again."
        : "Cannot connect right now. Check your connection and try again.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(
      data?.error || "This service is unavailable. Please try again.",
    );
  return data;
}
