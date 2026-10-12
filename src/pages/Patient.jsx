import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQueue } from "../useQueue.js";
import {
  DEPTS, AVG, BUFFER, SPEEDS, HOSPITAL, SRC_LABEL,
  pad, fmt, sortQueue, haversine, browserNotify, enableNotifications,
} from "../lib.js";

export default function Patient() {
  const { state, send, error } = useQueue();
  const [name, setName] = useState("");
  const [dept, setDept] = useState(DEPTS[0]);
  const [mode, setMode] = useState("car");
  const [myToken, setMyToken] = useState(() => Number(localStorage.getItem("mq_token")) || null);
  const [loc, setLoc] = useState(null);
  const [locMsg, setLocMsg] = useState("Share your location to calculate travel time.");
  const [route, setRoute] = useState(null);
  const [alertMsg, setAlertMsg] = useState("");
  const [now, setNow] = useState(Date.now());
  const prev = useRef(null);
  const anchor = useRef({ key: "", leaveAt: 0, turnAt: 0, shown: false });

  const notify = (m) => { setAlertMsg(m); browserNotify("MedQueue", m); };

  /* ---- derived queue info ---- */
  const patients = state ? state.patients : [];
  const me = patients.find((p) => p.token === myToken) || null;
  const q = sortQueue(patients);
  const calledNow = patients.find((p) => p.status === "called");
  let ahead = "--", wait = "--", waitMin = null, status = "⚪ Not registered";
  if (me) {
    if (me.status === "waiting") {
      ahead = q.findIndex((p) => p.token === me.token) + (calledNow ? 1 : 0);
      waitMin = Math.max(AVG, ahead * AVG);
      wait = waitMin + " min";
      status = "🟢 You are in the queue";
    } else if (me.status === "called") { ahead = 0; wait = "NOW"; status = "🔔 YOUR TURN! Please go to the consultation room."; }
    else if (me.status === "absent") status = "⚠️ Marked absent — please contact reception.";
    else status = "✅ Consultation completed";
  }

  /* ---- clock tick (keeps countdown fresh) ---- */
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  /* ---- QR gate check-in: /?checkin=TOKEN ---- */
  useEffect(() => {
    const t = Number(new URLSearchParams(window.location.search).get("checkin"));
    if (!t) return;
    send("checkin", { token: t }).then((s) => {
      if (s) notify("✅ Token #" + pad(t) + " checked in at the hospital gate.");
      window.history.replaceState(null, "", window.location.pathname);
    });
    // eslint-disable-next-line
  }, []);

  /* ---- alerts when reception changes something ---- */
  useEffect(() => {
    if (!me) { prev.current = null; return; }
    const p = prev.current;
    if (p && p.t === me.token) {
      if (me.status === "called" && p.s !== "called") notify("🔔 YOUR TURN! Please proceed to the consultation room.");
      else if (me.status === "absent" && p.s !== "absent") notify("⚠️ You were marked absent. Please contact reception.");
      else if (me.status === "waiting" && me.priority && !p.pr) notify("🚨 You have been given priority in the queue.");
      else if (me.status === "waiting" && me.order > p.o) notify("⏭ You were moved to the end of the queue.");
    }
    prev.current = { t: me.token, s: me.status, pr: me.priority, o: me.order };
    // eslint-disable-next-line
  }, [me?.token, me?.status, me?.priority, me?.order]);

  /* ---- travel time (server route, offline estimate as fallback) ---- */
  useEffect(() => {
    if (!loc) return;
    let dead = false;
    const run = async () => {
      try {
        const r = await fetch(`/api/route?lat=${loc.lat}&lon=${loc.lon}&mode=${mode}`);
        if (!r.ok) throw new Error("route");
        const j = await r.json();
        if (!dead) setRoute({ km: j.km, min: j.min, src: j.src });
      } catch {
        const km = haversine(loc.lat, loc.lon, HOSPITAL.lat, HOSPITAL.lon) * 1.3;
        if (!dead) setRoute({ km, min: Math.max(1, Math.ceil((km / SPEEDS[mode]) * 60)), src: "est" });
      }
    };
    run();
    const id = setInterval(run, 120000); // refresh traffic every 2 minutes
    return () => { dead = true; clearInterval(id); };
  }, [loc, mode]);

  /* ---- leave-home countdown ---- */
  let leave = null, remain = null;
  if (me && me.status === "waiting" && !me.arrived && route) {
    const key = `${me.token}|${waitMin}|${route.min}`;
    if (anchor.current.key !== key) {
      anchor.current = {
        key, shown: false,
        leaveAt: Date.now() + (waitMin - route.min - BUFFER) * 60000,
        turnAt: Date.now() + waitMin * 60000,
      };
    }
    leave = anchor.current;
    remain = Math.ceil((leave.leaveAt - now) / 60000);
  }
  useEffect(() => {
    if (leave && remain <= 0 && !anchor.current.shown) {
      anchor.current.shown = true;
      notify("🚗 It is time to leave home! Your turn is approaching.");
    }
  });

  /* ---- handlers ---- */
  async function join() {
    if (!name.trim()) return alert("Please enter your name.");
    if (me && (me.status === "waiting" || me.status === "called"))
      return alert("You already have an active token (#" + pad(me.token) + ").");
    const s = await send("join", { name: name.trim(), dept });
    if (s && s.joined) { localStorage.setItem("mq_token", s.joined); setMyToken(s.joined); }
  }
  function getLocation() {
    if (!navigator.geolocation) return setLocMsg("❌ Geolocation not supported. Use the demo location.");
    setLocMsg("📍 Getting your location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocMsg("✅ Home location detected."); },
      () => setLocMsg("❌ Location blocked or unavailable (needs HTTPS or localhost). Use the demo location."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
  function demoLocation() {
    setLoc({ lat: HOSPITAL.lat + 0.045, lon: HOSPITAL.lon + 0.01 });
    setLocMsg("✅ Demo location set (~5 km from hospital).");
  }

  /* ---- leave box content ---- */
  let leaveCls = "leave-box", leaveBody = "📍 Join the queue and share your location to calculate when you should leave.";
  if (me) {
    if (me.status !== "waiting") leaveBody = me.status === "called" ? "🔔 It is your turn — please go to the doctor." : "ℹ️ No travel plan needed right now.";
    else if (me.arrived) leaveBody = "✅ You are checked in at the hospital. Please wait for your token to be called.";
    else if (!route) leaveBody = "📍 Share your location to calculate when you should leave.";
    else if (remain <= 0) {
      leaveCls += " danger";
      leaveBody = <>🚨 <strong>LEAVE HOME NOW!</strong><br /><br />Travel ~{route.min} min — your turn is approaching.</>;
    } else {
      leaveBody = <>🚗 <strong>Leave home in {remain} min.</strong><br /><br />🏠 Leave at: {fmt(leave.leaveAt)}<br />🏥 Estimated turn: {fmt(leave.turnAt)}</>;
    }
  }

  const gateURL = me ? `${window.location.origin}/?checkin=${me.token}` : "";
  const active = me && (me.status === "waiting" || me.status === "called");

  return (
    <>
      <section className="hero">
        <h1>Smart Hospital <span>Queue</span></h1>
        <p>Join the hospital queue digitally, see live travel time with traffic, check in with a QR code, and get an alert when it is time to leave home.</p>
        <button className="btn" onClick={() => document.getElementById("patient")?.scrollIntoView()}>Get Your Token</button>
      </section>

      <div className="container">
        {error && <p style={{ color: "#a10000", fontWeight: "bold", marginBottom: 16 }}>⚠️ {error}</p>}
        {!state && !error && <p>Loading queue…</p>}

        <div className="cards">
          <div className="card" id="patient">
            <h2>👤 Patient Registration</h2>
            <label>Patient Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" maxLength={40} />
            <label>Department</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)}>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <label>Travel Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="car">🚗 Car</option>
              <option value="bike">🏍️ Bike</option>
              <option value="walk">🚶 Walking</option>
            </select>
            <button className="btn form-btn" onClick={join}>🎫 Join Queue</button>

            <div className="location-box">
              <h3>📍 Home Location</h3>
              <p className="location-status">{locMsg}</p>
              <button className="small-btn" onClick={getLocation}>📍 Use My Location</button>
              <button className="small-btn" onClick={demoLocation}>🧪 Use Demo Location (~5 km)</button>
            </div>
            <button className="small-btn" onClick={enableNotifications}>🔔 Enable Notifications</button>
          </div>

          <div className="card ticket">
            <h2>🎫 Your Queue Ticket</h2>
            <p>Token Number</p>
            <div className="token">{me ? "#" + pad(me.token) : "--"}</div>
            <h3>{me ? me.name : "No patient registered"}</h3>
            <p>{me ? me.dept : "Choose a department"}</p>
            <div className="badges">
              {me?.priority && <span className="tag">🚨 PRIORITY</span>}
              {me && <span className="tag">{me.arrived ? "📍 Checked in" : "🚶 On the way"}</span>}
            </div>
            <div className="ticket-info">
              <div><span>Patients Ahead</span><strong>{ahead}</strong></div>
              <div><span>Queue Wait</span><strong>{wait}</strong></div>
            </div>
            <div className="queue-status">{status}</div>
            {active && (
              <div className="qrbox" style={{ display: "block" }}>
                {me.arrived ? (
                  <p>✅ You are checked in at the hospital.</p>
                ) : (
                  <>
                    <div className="qrcode"><QRCodeSVG value={gateURL} size={120} /></div>
                    <p>Scan this QR at the hospital gate to check in.</p>
                    <button className="small-btn" onClick={() => send("checkin", { token: me.token })}>📷 Simulate Gate Scan</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="travel-card">
          <h2>🚗 Home → Hospital Travel Planner</h2>
          <div className="travel-grid">
            <div className="travel-item"><span>📏 Distance</span><strong>{route ? route.km.toFixed(1) + " km" : "--"}</strong></div>
            <div className="travel-item"><span>🚗 Travel Time</span><strong>{route ? route.min + " min" : "--"}</strong></div>
            <div className="travel-item"><span>⏳ Queue Time</span><strong>{waitMin ? waitMin + " min" : "--"}</strong></div>
            <div className="travel-item"><span>🛡️ Safety Buffer</span><strong>{BUFFER} min</strong></div>
          </div>
          <p className="travelsrc">{route ? SRC_LABEL[route.src] : ""}</p>
          <div className={leaveCls}>{leaveBody}</div>
        </div>
      </div>

      {alertMsg && (
        <div className="alert-box" style={{ display: "block" }}>
          <h3>🔔 MedQueue Alert</h3>
          <p>{alertMsg}</p>
          <button onClick={() => setAlertMsg("")}>OK</button>
        </div>
      )}
    </>
  );
}
