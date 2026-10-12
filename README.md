# MedQueue (React + Netlify)

Frontend: React + Vite. Backend: Netlify Functions + Netlify Blobs (shared queue). Live updates by polling every 3 s.

## Structure
- netlify/functions/state.mjs   queue API (join, call next, urgent, skip, absent, check-in, reset)
- netlify/functions/route.mjs   travel time (Mapbox live traffic, OSRM fallback)
- src/pages/Patient.jsx         registration, ticket, QR, travel planner, leave alert
- src/pages/Reception.jsx       receptionist dashboard (/reception)
- src/useQueue.js, src/lib.js   shared hook + helpers
- netlify.toml                  build + functions + SPA redirect

## Run locally
1. Install Node.js LTS.
2. `npm install`
3. Copy `.env.example` to `.env` and paste your Mapbox token (optional).
4. `npm run dev`  -> open http://localhost:8888  (not 5173)
   Patient page: /   Receptionist page: /reception

## Deploy
1. Push to GitHub. 2. Netlify -> Add new site -> Import project -> Deploy.
3. Site configuration -> Environment variables: add MAPBOX_TOKEN (and HOSPITAL_LAT/HOSPITAL_LON). Redeploy.
4. Update HOSPITAL in src/lib.js to match your hospital.
