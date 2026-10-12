import { useEffect, useState } from "react";
import { useQueue } from "../useQueue.js";
import { DEPTS, pad, sortQueue } from "../lib.js";

function Row({ p, send }) {
  const act = (action) => send(action, { token: p.token });
  const label = { called: "🔔 Now serving", waiting: "⏳ Waiting", absent: "🚫 Absent" }[p.status];
  return (
    <tr className={p.status}>
      <td>#{pad(p.token)}</td>
      <td>{p.name}<br /><small>{p.dept}</small></td>
      <td>
        {label}<br />
        {p.priority && <span className="tag red">🚨 Urgent</span>}
        {p.arrived ? <span className="tag green">📍 Arrived</span> : <span className="tag">🚶 On the way</span>}
      </td>
      <td>
        {p.status === "called" && (
          <>
            <button onClick={() => act("done")}>✔ Done</button>
            <button onClick={() => act("end")}>⏭ To end</button>
            <button className="d" onClick={() => act("absent")}>🚫 Absent</button>
          </>
        )}
        {p.status === "waiting" && (
          <>
            <button onClick={() => act("urgent")}>{p.priority ? "Remove urgent" : "🚨 Urgent"}</button>
            {!p.arrived && <button onClick={() => act("checkin")}>📍 Check in</button>}
            <button onClick={() => act("end")}>⏭ Skip</button>
          </>
        )}
        {p.status === "absent" && <button onClick={() => act("requeue")}>↩ Re-queue</button>}
      </td>
    </tr>
  );
}

function Dashboard({ onLock }) {
  const { state, send, error } = useQueue();
  const [wName, setWName] = useState("");
  const [wDept, setWDept] = useState(DEPTS[0]);
  const [wUrgent, setWUrgent] = useState(false);

  const patients = state ? state.patients : [];
  const called = patients.find((p) => p.status === "called");
  const q = sortQueue(patients);
  const absent = patients.filter((p) => p.status === "absent");
  const rows = (called ? [called] : []).concat(q, absent);

  async function addWalkIn() {
    if (!wName.trim()) return alert("Enter the walk-in patient name.");
    const s = await send("join", { name: wName.trim(), dept: wDept, urgent: wUrgent, walkin: true });
    if (s) { setWName(""); setWUrgent(false); }
  }
  async function callNext() {
    const s = await send("callNext");
    if (s && !s.patients.some((p) => p.status === "called")) alert("No patients are waiting.");
  }
  function reset() {
    if (window.confirm("Reset all queue data?")) {
      localStorage.removeItem("mq_token");
      send("reset");
    }
  }

  return (
    <div className="container">
      {error && <p style={{ color: "#a10000", fontWeight: "bold", marginBottom: 16 }}>⚠️ {error}</p>}
      <div className="card" style={{ marginTop: 0 }}>
        <h2>🧑‍💼 Receptionist Dashboard</h2>
        <div className="stats">
          <div className="stat"><strong>{called ? "#" + pad(called.token) : "--"}</strong><span>Now Serving</span></div>
          <div className="stat"><strong>{q.length}</strong><span>Waiting</span></div>
          <div className="stat"><strong>5 min</strong><span>Average Time</span></div>
          <div className="stat"><strong>{state ? state.completed : 0}</strong><span>Completed</span></div>
        </div>

        <div className="actions">
          <button className="btn" onClick={callNext}>📢 Call Next Patient</button>
          <button className="btn grey" onClick={reset}>♻️ Reset Demo Data</button>
          <button className="btn grey" onClick={onLock}>🔒 Lock</button>
        </div>

        <div className="walkin">
          <input type="text" value={wName} onChange={(e) => setWName(e.target.value)} placeholder="Walk-in patient name" maxLength={40} />
          <select value={wDept} onChange={(e) => setWDept(e.target.value)}>
            {DEPTS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <label><input type="checkbox" checked={wUrgent} onChange={(e) => setWUrgent(e.target.checked)} /> 🚨 Urgent</label>
          <button className="btn" onClick={addWalkIn}>➕ Add</button>
        </div>

        <div className="tbl">
          <table>
            <thead><tr><th>Token</th><th>Patient</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.length ? rows.map((p) => <Row key={p.token} p={p} send={send} />)
                : <tr><td colSpan="4">{state ? "Queue is empty." : "Loading…"}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Reception() {
  const [unlocked, setUnlocked] = useState(!!sessionStorage.getItem("mq_pin"));
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const f = () => { setUnlocked(false); setMsg("PIN required. Please enter it again."); };
    window.addEventListener("mq-locked", f);
    return () => window.removeEventListener("mq-locked", f);
  }, []);

  async function login(e) {
    e.preventDefault();
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pin": pin },
        body: JSON.stringify({ action: "login" }),
      });
      if (r.ok) { sessionStorage.setItem("mq_pin", pin); setUnlocked(true); setMsg(""); setPin(""); }
      else { const j = await r.json().catch(() => ({})); setMsg(j.error || "Wrong PIN."); }
    } catch { setMsg("Server not reachable."); }
  }
  function lock() { sessionStorage.removeItem("mq_pin"); setUnlocked(false); }

  if (!unlocked) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
          <h2>🔒 Receptionist Login</h2>
          <form onSubmit={login}>
            <label>Enter PIN</label>
            <input type="password" inputMode="numeric" value={} onChange={(e) => setPin(e.target.value)} autoFocus />
            <button className="btn form-btn" type="submit">Unlock</button>
          </form>
          {msg && <p style={{ marginTop: 15, color: "#a10000", fontWeight: "bold" }}>{msg}</p>}
        </div>
      </div>
    );
  }
  return <Dashboard onLock={lock} />;
}
