// Travel time from the patient's location to the hospital.
// Uses Mapbox (live traffic) if MAPBOX_TOKEN is set, otherwise the free OSRM road router.
const HLAT = process.env.HOSPITAL_LAT || "11.0168";
const HLON = process.env.HOSPITAL_LON || "76.9558";

async function getJSON(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error("http " + r.status);
  return r.json();
}

export default async (req) => {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lon = Number(u.searchParams.get("lon"));
  const walk = u.searchParams.get("mode") === "walk";
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Response.json({ error: "lat/lon required" }, { status: 400 });
  const coords = `${lon},${lat};${HLON},${HLAT}`;

  try {
    if (process.env.MAPBOX_TOKEN) {
      const profile = walk ? "walking" : "driving-traffic";
      const j = await getJSON(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?overview=false&access_token=${process.env.MAPBOX_TOKEN}`);
      const rt = j.routes?.[0];
      if (rt) return Response.json({ km: rt.distance / 1000, min: Math.max(1, Math.ceil(rt.duration / 60)), src: walk ? "road" : "traffic" });
    }
  } catch {}
  try {
    if (!walk) {
      const j = await getJSON(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`);
      const rt = j.routes?.[0];
      if (rt) return Response.json({ km: rt.distance / 1000, min: Math.max(1, Math.ceil(rt.duration / 60)), src: "road" });
    }
  } catch {}
  return Response.json({ error: "no route" }, { status: 502 });
};

export const config = { path: "/api/route" };
