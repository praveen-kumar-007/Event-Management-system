import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import Sidebar from "./components/Sidebar";
import BrandingBar from "./components/BrandingBar";
import Dashboard from "./pages/Dashboard";
import Registration from "./pages/Registration";
import UserRegistration from "./pages/UserRegistration";
import Roster from "./pages/Roster";
import MatchManagement from "./pages/MatchManagement";
import RefereeDashboard from "./pages/RefereeDashboard";
import Scoreboard from "./pages/Scoreboard";
import OfficialsManagement from "./pages/OfficialsManagement";
import OfficialScoreSheet from "./pages/OfficialScoreSheet";
import EventManagement from "./pages/EventManagement";
import "./index.css";

function AppRouter() {
  const location = useLocation();
  const hideSidebar = location.pathname === "/";

  return (
    <>
      <BrandingBar />
      <div className="app-layout">
        {!hideSidebar && <Sidebar />}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<UserRegistration />} />
            <Route path="/dashboard" element={<Dashboard />} />
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
    </>
  );
}

function App() {
  return (
    <Router>
      <AppRouter />
    </Router>
  );
}

export default App;
