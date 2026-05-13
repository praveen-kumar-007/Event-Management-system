import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  UserPlus,
  Trophy,
  Camera,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  EVENT_CHANGE_EVENT,
  getActiveEventId,
  setActiveEventId,
} from "../utils/eventSelection";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Registration = () => {
  const [tab, setTab] = useState("team");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [states, setStates] = useState([]);
  const [districtsByState, setDistrictsByState] = useState({});
  const [allDistricts, setAllDistricts] = useState([]);
  const [geoNotice, setGeoNotice] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [formData, setFormData] = useState({
    eventId: "",
    teamName: "",
    state: "",
    district: "",
    coach: "",
    playerName: "",
    email: "",
    phone: "",
    age: "",
    weight: "",
    position: "Raider",
    teamId: "",
    dob: "",
    aadhar: "",
    photoUrl: "",
  });

  const districtOptions = useMemo(() => {
    if (formData.state && Array.isArray(districtsByState[formData.state])) {
      return districtsByState[formData.state];
    }
    return allDistricts;
  }, [formData.state, districtsByState, allDistricts]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const [eventsRes, locationRes, detectRes] = await Promise.all([
          axios.get(`${API_URL}/api/matches/events`),
          axios.get(`${API_URL}/api/matches/location/options`),
          axios.get(`${API_URL}/api/matches/location/detect`),
        ]);

        const eventsData = Array.isArray(eventsRes.data) ? eventsRes.data : [];
        const optionsData = locationRes.data || {};
        const detectData = detectRes.data || {};

        setEvents(eventsData);
        setStates(Array.isArray(optionsData.states) ? optionsData.states : []);
        setDistrictsByState(optionsData.districtsByState || {});
        setAllDistricts(
          Array.isArray(optionsData.allDistricts)
            ? optionsData.allDistricts
            : [],
        );

        const fromStorage = getActiveEventId();
        const selectedEvent =
          eventsData.find((entry) => entry.id === fromStorage) ||
          eventsData.find((entry) => entry.isActive) ||
          eventsData[0];

        if (selectedEvent?.id) {
          setActiveEventId(selectedEvent.id);
        }

        setFormData((current) => ({
          ...current,
          eventId: selectedEvent?.id || current.eventId,
          state: detectData.state || current.state,
          district: detectData.district || current.district,
        }));

        if (detectData.state || detectData.district) {
          setGeoNotice(
            "State and district were auto-detected from your IP. You can change them.",
          );
        }
      } catch (err) {
        console.error("Failed to initialize registration", err);
      }
    };

    bootstrap();

    const onEventChange = (evt) => {
      setFormData((current) => ({
        ...current,
        eventId: evt.detail?.eventId || getActiveEventId(),
      }));
    };

    window.addEventListener(EVENT_CHANGE_EVENT, onEventChange);
    return () => window.removeEventListener(EVENT_CHANGE_EVENT, onEventChange);
  }, []);

  useEffect(() => {
    if (!formData.eventId) {
      setTeams([]);
      return;
    }

    const fetchTeams = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/matches/teams`, {
          params: { eventId: formData.eventId },
        });
        setTeams(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Unable to fetch event teams", err);
      }
    };

    fetchTeams();
  }, [formData.eventId, tab]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    const uploadData = new FormData();
    uploadData.append("photo", file);

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/api/matches/upload`, uploadData);
      setFormData({ ...formData, photoUrl: res.data.url });
    } catch {
      setFormData({ ...formData, photoUrl: URL.createObjectURL(file) });
    } finally {
      setLoading(false);
    }
  };

  const startLiveCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (error) {
      alert("Camera access is required to take a live photo.");
    }
  };

  const stopLiveCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setCameraOpen(false);
  };

  const captureLivePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setPhotoPreview(dataUrl);
    setFormData((current) => ({ ...current, photoUrl: dataUrl }));
    stopLiveCamera();
  };

  const handleSubmitTeam = async (e) => {
    e.preventDefault();
    if (!formData.eventId) return alert("Please select an event first.");

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/matches/teams`, {
        eventId: formData.eventId,
        name: formData.teamName,
        state: formData.state,
        district: formData.district,
        coach: formData.coach,
      });
      setTeams((currentTeams) => [...currentTeams, res.data]);
      setStep(3); // Success step
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPlayer = async (e) => {
    e.preventDefault();
    if (!formData.photoUrl) return alert("Please upload a player photo");
    if (!formData.eventId) return alert("Please select an event first.");

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/matches/players`, {
        eventId: formData.eventId,
        name: formData.playerName,
        email: formData.email,
        phone: formData.phone,
        age: formData.age,
        weight: formData.weight,
        position: formData.position,
        teamId: formData.teamId,
        dob: formData.dob,
        aadhar: formData.aadhar,
        photoUrl: formData.photoUrl,
      });
      setStep(3); // Success step
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      eventId: getActiveEventId(),
      teamName: "",
      state: "",
      district: "",
      coach: "",
      playerName: "",
      email: "",
      phone: "",
      age: "",
      weight: "",
      position: "Raider",
      teamId: "",
      dob: "",
      aadhar: "",
      photoUrl: "",
    });
    setPhotoPreview(null);
    setStep(1);
  };

  return (
    <div className="animate-fade-in">
      <header style={{ marginBottom: "2rem" }}>
        <h1 className="title-glow">
          Registration <span className="text-gradient">Portal</span>
        </h1>
        <p style={{ color: "var(--text-muted)" }}>
          Complete event-wise team, district, and player registration with state
          controls.
        </p>
      </header>

      <div
        className="glass-panel"
        style={{ padding: "2.5rem", maxWidth: "900px", margin: "0 auto" }}
      >
        {step !== 3 && (
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginBottom: "3rem",
              borderBottom: "1px solid var(--glass-border)",
              paddingBottom: "1.5rem",
            }}
          >
            <button
              className={`btn ${tab === "team" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setTab("team");
                setStep(1);
              }}
            >
              <Trophy size={20} /> Register Team
            </button>
            <button
              className={`btn ${tab === "player" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => {
                setTab("player");
                setStep(1);
              }}
            >
              <UserPlus size={20} /> Register Player
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {tab === "team" && step === 1 && (
            <motion.form
              key="team-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmitTeam}
            >
              <h2 style={{ marginBottom: "1.5rem", color: "var(--primary)" }}>
                Team Details
              </h2>
              {geoNotice && (
                <div
                  className="sheet-block"
                  style={{ marginBottom: "1rem", padding: "0.8rem 1rem" }}
                >
                  <span className="muted">{geoNotice}</span>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "2rem",
                }}
              >
                <div className="form-group">
                  <label className="form-label">Team Name</label>
                  <input
                    className="form-control"
                    required
                    placeholder="e.g. Pune Panthers"
                    value={formData.teamName}
                    onChange={(e) =>
                      setFormData({ ...formData, teamName: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Event</label>
                  <select
                    className="form-control"
                    required
                    value={formData.eventId}
                    onChange={(e) => {
                      setActiveEventId(e.target.value);
                      setFormData({
                        ...formData,
                        eventId: e.target.value,
                        teamId: "",
                      });
                    }}
                  >
                    <option value="">-- Select Event --</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <select
                    className="form-control"
                    required
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        state: e.target.value,
                        district: "",
                      })
                    }
                  >
                    <option value="">-- Select State --</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">District Selection</label>
                  {districtOptions.length > 0 ? (
                    <select
                      className="form-control"
                      required
                      value={formData.district}
                      onChange={(e) =>
                        setFormData({ ...formData, district: e.target.value })
                      }
                    >
                      <option value="">-- Select District --</option>
                      {districtOptions.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-control"
                      disabled
                      placeholder="District options are loading"
                    />
                  )}
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Head Coach Name</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Enter Coach Name"
                    value={formData.coach}
                    onChange={(e) =>
                      setFormData({ ...formData, coach: e.target.value })
                    }
                  />
                </div>
              </div>
              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Register Team"}{" "}
                  <ArrowRight size={20} />
                </button>
              </div>
            </motion.form>
          )}

          {tab === "player" && step === 1 && (
            <motion.form
              key="player-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmitPlayer}
            >
              <h2 style={{ marginBottom: "1.5rem", color: "var(--secondary)" }}>
                Player Registration
              </h2>
              {geoNotice && (
                <div
                  className="sheet-block"
                  style={{ marginBottom: "1rem", padding: "0.8rem 1rem" }}
                >
                  <span className="muted">{geoNotice}</span>
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "320px 1fr",
                  gap: "2rem",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "350px",
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: "20px",
                      border: "2px dashed var(--glass-border)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      marginBottom: "1rem",
                      position: "relative",
                    }}
                  >
                    {cameraOpen ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : photoPreview ? (
                      <img
                        src={photoPreview}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        alt="Player"
                      />
                    ) : (
                      <>
                        <Camera
                          size={64}
                          color="var(--text-muted)"
                          style={{ marginBottom: "1rem" }}
                        />
                        <span style={{ color: "var(--text-muted)" }}>
                          Take a live photo or upload one
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={cameraOpen ? captureLivePhoto : startLiveCamera}
                    >
                      <Camera size={18} />{" "}
                      {cameraOpen ? "Capture Live Photo" : "Take Live Photo"}
                    </button>
                    {cameraOpen && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={stopLiveCamera}
                      >
                        Cancel Camera
                      </button>
                    )}
                    <label
                      className="btn btn-secondary"
                      style={{ width: "100%" }}
                    >
                      <Upload size={20} /> Upload From Device
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.25rem",
                  }}
                >
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label className="form-label">Full Name</label>
                    <input
                      className="form-control"
                      required
                      placeholder="Enter legal name"
                      value={formData.playerName}
                      onChange={(e) =>
                        setFormData({ ...formData, playerName: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Event</label>
                    <select
                      className="form-control"
                      required
                      value={formData.eventId}
                      onChange={(e) => {
                        setActiveEventId(e.target.value);
                        setFormData({
                          ...formData,
                          eventId: e.target.value,
                          teamId: "",
                        });
                      }}
                    >
                      <option value="">-- Select Event --</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Assign to Team (District-wise)
                    </label>
                    <select
                      className="form-control"
                      required
                      value={formData.teamId}
                      onChange={(e) =>
                        setFormData({ ...formData, teamId: e.target.value })
                      }
                    >
                      <option value="">-- Select Registered Team --</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.state} / {t.district})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      required
                      placeholder="player@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="tel"
                      className="form-control"
                      required
                      placeholder="10-digit mobile number"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Aadhar Number (KYC)</label>
                    <input
                      className="form-control"
                      required
                      placeholder="12-digit UID"
                      value={formData.aadhar}
                      onChange={(e) =>
                        setFormData({ ...formData, aadhar: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-control"
                      required
                      value={formData.dob}
                      onChange={(e) =>
                        setFormData({ ...formData, dob: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Current Age</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      placeholder="e.g. 24"
                      value={formData.age}
                      onChange={(e) =>
                        setFormData({ ...formData, age: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Weight (in KG)</label>
                    <input
                      type="number"
                      className="form-control"
                      required
                      placeholder="e.g. 80"
                      value={formData.weight}
                      onChange={(e) =>
                        setFormData({ ...formData, weight: e.target.value })
                      }
                    />
                    <small
                      style={{
                        color: "var(--warning)",
                        marginTop: "0.5rem",
                        display: "block",
                      }}
                    >
                      * Must be under 85kg for Pro categories
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primary Position</label>
                    <select
                      className="form-control"
                      value={formData.position}
                      onChange={(e) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                    >
                      <option value="Raider">Raider (Offense)</option>
                      <option value="Left Corner">Left Corner (Defense)</option>
                      <option value="Right Corner">
                        Right Corner (Defense)
                      </option>
                      <option value="Left Cover">Left Cover (Defense)</option>
                      <option value="Right Cover">Right Cover (Defense)</option>
                      <option value="All-rounder">All-rounder</option>
                    </select>
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: "2rem",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Finalizing..." : "Complete Registration"}{" "}
                  <CheckCircle size={20} />
                </button>
              </div>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="score-card"
            >
              <CheckCircle
                size={100}
                color="var(--accent)"
                style={{ margin: "0 auto 2rem" }}
              />
              <h2 className="title-glow" style={{ fontSize: "2.5rem" }}>
                Successfully Registered!
              </h2>
              <p
                style={{
                  color: "var(--text-muted)",
                  marginBottom: "3rem",
                  fontSize: "1.2rem",
                }}
              >
                The {tab} has been added to the official tournament database.
              </p>
              <button className="btn btn-primary" onClick={resetForm}>
                Register Another {tab === "team" ? "Team" : "Player"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Registration;
