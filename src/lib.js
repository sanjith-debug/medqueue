export const DEPTS = ["General Medicine", "Cardiology", "Orthopedics", "Pediatrics", "Dermatology"];
export const AVG = 5;       // minutes per patient
export const BUFFER = 10;   // safety buffer in minutes
export const SPEEDS = { car: 30, bike: 35, walk: 5 }; // km/h, offline estimate only
// Keep in sync with HOSPITAL_LAT / HOSPITAL_LON in .env (used for demo location + offline estimate)
export const HOSPITAL = { lat: 11.0168, lon: 76.9558 };
export const SRC_LABEL = {
  traffic: "🚦 Live traffic",
  road: "🛣️ Road route (no live traffic)",
  est: "📐 Straight-line estimate",
};

export const pad = (n) => String(n).padStart(3, "0");
export const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const sortQueue = (ps) =>
  ps.filter((p) => p.status === "waiting").sort((a, b) => (b.priority - a.priority) || (a.order - b.order));

export function haversine(a, b, c, d) {
  const r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function browserNotify(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  } catch {}
}
export function enableNotifications() {
  if (!("Notification" in window)) return alert("Browser notifications are not supported.");
  Notification.requestPermission().then((p) =>
    alert(p === "granted" ? "✅ Notifications enabled!" : "Notification permission was not granted.")
  );
}
