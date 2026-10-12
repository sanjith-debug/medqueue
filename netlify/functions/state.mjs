import { getStore } from "@netlify/blobs";

const DEPTS = ["General Medicine", "Cardiology", "Orthopedics", "Pediatrics", "Dermatology"];
const NAMES = ["Ravi", "Anita", "Suresh", "Meena", "Karthik", "Divya", "Arun", "Lakshmi"];

const seed = () => ({
  nextToken: NAMES.length + 1,
  order: NAMES.length + 1,
  completed: 0,
  patients: NAMES.map((name, i) => ({
    token: i + 1, name, dept: DEPTS[i % DEPTS.length],
    status: "waiting", priority: false, arrived: i % 3 === 0, order: i + 1,
  })),
});

const waitingQueue = (S) =>
  S.patients.filter((x) => x.status === "waiting")
    .sort((a, b) => (b.priority - a.priority) || (a.order - b.order));

export default async (req) => {
  const store = getStore("medqueue");
  let S = (await store.get("state", { type: "json" })) || seed();
  let joined = null;

  if (req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return Response.json({ error: "Bad JSON" }, { status: 400 }); }
    const p = S.patients.find((x) => x.token === Number(b.token));

    switch (b.action) {
      case "join": {
        const name = String(b.name || "").trim().slice(0, 40);
        if (!name) return Response.json({ error: "Name required" }, { status: 400 });
        joined = S.nextToken++;
        S.patients.push({
          token: joined, name, dept: DEPTS.includes(b.dept) ? b.dept : DEPTS[0],
          status: "waiting", priority: !!b.urgent, arrived: !!b.walkin, order: S.order++,
        });
        break;
      }
      case "callNext": {
        const c = S.patients.find((x) => x.status === "called");
        if (c) { c.status = "done"; S.completed++; }
        const next = waitingQueue(S)[0];
        if (next) next.status = "called";
        break;
      }
      case "reset": S = seed(); break;
      case "urgent": if (p) p.priority = !p.priority; break;
      case "checkin": if (p) p.arrived = true; break;
      case "absent": if (p) p.status = "absent"; break;
      case "done": if (p) { p.status = "done"; S.completed++; } break;
      case "end": if (p) { p.status = "waiting"; p.priority = false; p.order = S.order++; } break;
      case "requeue": if (p) { p.status = "waiting"; p.order = S.order++; } break;
      default: return Response.json({ error: "Unknown action" }, { status: 400 });
    }
    await store.setJSON("state", S);
  }
  return Response.json({ ...S, joined });
};

export const config = { path: "/api/state" };
