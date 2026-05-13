import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Registration from "./pages/Registration";
import Roster from "./pages/Roster";
import MatchManagement from "./pages/MatchManagement";
import RefereeDashboard from "./pages/RefereeDashboard";
import Scoreboard from "./pages/Scoreboard";
import OfficialsManagement from "./pages/OfficialsManagement";
import OfficialScoreSheet from "./pages/OfficialScoreSheet";
import EventManagement from "./pages/EventManagement";
import "./index.css";

function App() {
  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/events" element={<EventManagement />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/registration" element={<Registration />} />
            <Route path="/matches" element={<MatchManagement />} />
            <Route path="/officials" element={<OfficialsManagement />} />
            <Route path="/official/:role" element={<RefereeDashboard />} />
            <Route path="/scoresheet" element={<OfficialScoreSheet />} />
            <Route path="/scoreboard" element={<Scoreboard />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
