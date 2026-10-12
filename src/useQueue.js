import { useCallback, useEffect, useState } from "react";

// Loads the shared queue from the backend and refreshes it every 3 seconds.
export function useQueue() {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/state");
      if (!r.ok) throw new Error("HTTP " + r.status);
      setState(await r.json());
      setError("");
    } catch {
      setError("Cannot reach the server. Run the app with: npm run dev (Netlify dev), not plain Vite.");
    }
  }, []);

  const send = useCallback(async (action, data = {}) => {
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });
      const s = await r.json();
      if (!r.ok) { alert(s.error || "Request failed"); return null; }
      setState(s);
      return s;
    } catch {
      alert("Server not reachable.");
      return null;
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  return { state, send, error };
}
