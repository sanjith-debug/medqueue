import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Patient from "./pages/Patient.jsx";
import Reception from "./pages/Reception.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <header>
        <div className="logo">🏥 MedQueue</div>
        <nav>
          <Link to="/">Patient</Link>
          <Link to="/reception">Reception</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Patient />} />
        <Route path="/reception" element={<Reception />} />
      </Routes>
      <footer>
        <h3>🏥 MedQueue</h3>
        <p>Smart Hospital Queue Management</p>
        <p>Hackathon / Expo Prototype</p>
      </footer>
    </BrowserRouter>
  );
}
