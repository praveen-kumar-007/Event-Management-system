const { db } = require("../config/firebase");
const { generateFixtures: genFix } = require("../utils/fixtureGenerator");
const {
  getAllStates,
  getDistricts,
  getCurrentState,
} = require("india-state-district");
const fs = require("fs");
const path = require("path");

const fallbackStorePath = path.join(
  __dirname,
  "..",
  "data",
  "local-store.json",
);

const defaultStore = {
  events: [],
  teams: [],
  players: [],
  matches: [],
};

const ensureFallbackStore = () => {
  const storeDir = path.dirname(fallbackStorePath);
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true });
  }

  if (!fs.existsSync(fallbackStorePath)) {
    fs.writeFileSync(fallbackStorePath, JSON.stringify(defaultStore, null, 2));
  }
};

const readFallbackStore = () => {
  try {
    ensureFallbackStore();
    const raw = fs.readFileSync(fallbackStorePath, "utf8");
    return { ...defaultStore, ...JSON.parse(raw) };
  } catch (error) {
    console.error("Fallback store read error:", error.message);
    return { ...defaultStore };
  }
};

const writeFallbackStore = (nextStore) => {
  try {
    ensureFallbackStore();
    fs.writeFileSync(fallbackStorePath, JSON.stringify(nextStore, null, 2));
  } catch (error) {
    console.error("Fallback store write error:", error.message);
  }
};

let memoryDB = readFallbackStore();

const mutateFallbackStore = (mutator) => {
  memoryDB = readFallbackStore();
  const nextStore = mutator(memoryDB) || memoryDB;
  memoryDB = nextStore;
  writeFallbackStore(memoryDB);
  return memoryDB;
};

const generateId = () =>
  `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const normalizeString = (value) => (value || "").toString().trim();
const normalizePhone = (value) =>
  normalizeString(value).replace(/\D/g, "").slice(0, 10);

const getEventIdFromReq = (req) =>
  normalizeString(req.query.eventId || req.body.eventId);

const buildLocationData = () => {
  const statesRaw = getAllStates() || [];
  const states = statesRaw
    .map((state) => state?.name)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const districtsByState = {};
  const allDistrictsSet = new Set();
  const stateCodeByName = {};

  statesRaw.forEach((entry) => {
    if (entry?.name && entry?.code) stateCodeByName[entry.name] = entry.code;
  });

  states.forEach((state) => {
    const stateCode = stateCodeByName[state] || "";
    const districts = (getDistricts(stateCode) || [])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    districtsByState[state] = districts;
    districts.forEach((district) => allDistrictsSet.add(district));
  });

  return {
    states,
    districtsByState,
    allDistricts: [...allDistrictsSet].sort((a, b) => a.localeCompare(b)),
  };
};

const locationData = buildLocationData();

const findClosestState = (stateName) => {
  if (!stateName) return "";
  const normalized = stateName.toLowerCase();
  return (
    locationData.states.find((state) => state.toLowerCase() === normalized) ||
    locationData.states.find((state) =>
      state.toLowerCase().includes(normalized),
    ) ||
    ""
  );
};

const findDistrictForState = (state, districtName) => {
  if (!state || !districtName) return "";
  const pool = locationData.districtsByState[state] || [];
  const normalized = districtName.toLowerCase();
  return (
    pool.find((district) => district.toLowerCase() === normalized) ||
    pool.find((district) => district.toLowerCase().includes(normalized)) ||
    ""
  );
};

const ensureEventInMemory = (eventId) =>
  memoryDB.events.some((event) => event.id === eventId);

// Location and metadata
const getLocationOptions = (_req, res) => {
  res.json(locationData);
};

const detectLocationFromIp = async (req, res) => {
  const requestIp =
    normalizeString(req.query.ip) ||
    normalizeString(req.headers["x-forwarded-for"]) ||
    normalizeString(req.ip).replace("::ffff:", "");

  try {
    const endpoint =
      requestIp && requestIp !== "::1" && requestIp !== "127.0.0.1"
        ? `https://ipapi.co/${encodeURIComponent(requestIp)}/json/`
        : "https://ipapi.co/json/";

    const response = await fetch(endpoint, { method: "GET" });
    const payload = await response.json();

    const guessedState = findClosestState(
      payload.region || payload.region_name || getCurrentState() || "",
    );
    const guessedDistrict = findDistrictForState(
      guessedState,
      payload.city_district || payload.city || payload.district || "",
    );

    res.json({
      ip: payload.ip || requestIp || "",
      state: guessedState,
      district: guessedDistrict,
      city: payload.city || "",
      source: "ipapi",
    });
  } catch (error) {
    console.error("IP location lookup failed:", error.message);
    res.json({
      state: "",
      district: "",
      city: "",
      source: "fallback",
    });
  }
};

// Events
const getEvents = async (_req, res) => {
  try {
    if (!db) throw new Error("Database not initialized");
    const snapshot = await db
      .collection("events")
      .orderBy("createdAt", "desc")
      .get();
    const events = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(events);
  } catch (error) {
    console.error(
      "Firestore Error in getEvents, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    const events = [...memoryDB.events].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.json(events);
  }
};

const addEvent = async (req, res) => {
  const name = normalizeString(req.body.name);
  if (!name) return res.status(400).json({ error: "Event name is required." });

  const event = {
    name,
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    startDate: normalizeString(req.body.startDate),
    endDate: normalizeString(req.body.endDate),
    isActive: Boolean(req.body.isActive),
    createdAt: new Date().toISOString(),
  };

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const docRef = await db.collection("events").add(event);
    if (event.isActive) {
      const snapshot = await db
        .collection("events")
        .where("isActive", "==", true)
        .get();
      const batch = db.batch();
      snapshot.docs
        .filter((doc) => doc.id !== docRef.id)
        .forEach((doc) => batch.update(doc.ref, { isActive: false }));
      await batch.commit();
    }
    res.status(201).json({ id: docRef.id, ...event });
  } catch (error) {
    console.error(
      "Firestore Error in addEvent, using memory fallback:",
      error.message,
    );
    const newEvent = { id: generateId(), ...event };
    mutateFallbackStore((store) => {
      if (event.isActive) {
        store.events = store.events.map((entry) => ({
          ...entry,
          isActive: false,
        }));
      }
      store.events.push(newEvent);
      return store;
    });
    res.status(201).json(newEvent);
  }
};

const updateEvent = async (req, res) => {
  const { id } = req.params;
  const updates = {
    name: normalizeString(req.body.name),
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    startDate: normalizeString(req.body.startDate),
    endDate: normalizeString(req.body.endDate),
    isActive:
      req.body.isActive === undefined ? undefined : Boolean(req.body.isActive),
  };

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const eventRef = db.collection("events").doc(id);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found." });
    }

    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined),
    );

    await eventRef.update(payload);

    if (payload.isActive) {
      const snapshot = await db
        .collection("events")
        .where("isActive", "==", true)
        .get();
      const batch = db.batch();
      snapshot.docs
        .filter((doc) => doc.id !== id)
        .forEach((doc) => batch.update(doc.ref, { isActive: false }));
      await batch.commit();
    }

    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updateEvent, using memory fallback:",
      error.message,
    );
    let updated = false;
    mutateFallbackStore((store) => {
      const index = store.events.findIndex((event) => event.id === id);
      if (index === -1) return store;
      const nextEvent = {
        ...store.events[index],
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.state ? { state: updates.state } : {}),
        ...(updates.district ? { district: updates.district } : {}),
        ...(updates.startDate ? { startDate: updates.startDate } : {}),
        ...(updates.endDate ? { endDate: updates.endDate } : {}),
        ...(updates.isActive === undefined
          ? {}
          : { isActive: updates.isActive }),
      };
      store.events[index] = nextEvent;
      updated = true;
      if (nextEvent.isActive) {
        store.events = store.events.map((event) => ({
          ...event,
          isActive: event.id === id,
        }));
      }
      return store;
    });
    if (!updated) return res.status(404).json({ error: "Event not found." });
    res.json({ success: true });
  }
};

const deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const eventRef = db.collection("events").doc(id);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      return res.status(404).json({ error: "Event not found." });
    }

    const [teamsSnapshot, playersSnapshot, matchesSnapshot] = await Promise.all(
      [
        db.collection("teams").where("eventId", "==", id).get(),
        db.collection("players").where("eventId", "==", id).get(),
        db.collection("matches").where("eventId", "==", id).get(),
      ],
    );

    const batch = db.batch();
    teamsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    playersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    matchesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(eventRef);
    await batch.commit();

    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deleteEvent, using memory fallback:",
      error.message,
    );
    let deleted = false;
    mutateFallbackStore((store) => {
      const exists = store.events.some((event) => event.id === id);
      if (!exists) return store;
      store.events = store.events.filter((event) => event.id !== id);
      store.teams = store.teams.filter((team) => team.eventId !== id);
      store.players = store.players.filter((player) => player.eventId !== id);
      store.matches = store.matches.filter((match) => match.eventId !== id);
      deleted = true;
      return store;
    });
    if (!deleted) return res.status(404).json({ error: "Event not found." });
    res.json({ success: true });
  }
};

const activateEvent = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const snapshot = await db
      .collection("events")
      .where("isActive", "==", true)
      .get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.update(doc.ref, { isActive: false }));
    batch.update(db.collection("events").doc(id), { isActive: true });
    await batch.commit();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in activateEvent, using memory fallback:",
      error.message,
    );
    mutateFallbackStore((store) => {
      store.events = store.events.map((event) => ({
        ...event,
        isActive: event.id === id,
      }));
      return store;
    });
    res.json({ success: true });
  }
};

// Teams
const getTeams = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  try {
    if (!db) throw new Error("Database not initialized");
    let query = db.collection("teams");
    if (eventId) query = query.where("eventId", "==", eventId);
    const snapshot = await query.get();
    const teams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(teams);
  } catch (error) {
    console.error(
      "Firestore Error in getTeams, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    const teams = eventId
      ? memoryDB.teams.filter((team) => team.eventId === eventId)
      : memoryDB.teams;
    res.json(teams);
  }
};

const addTeam = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId)
    return res.status(400).json({ error: "Event selection is required." });

  const team = {
    name: normalizeString(req.body.name),
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    coach: normalizeString(req.body.coach),
    eventId,
    createdAt: new Date().toISOString(),
  };

  if (!team.name || !team.state || !team.district || !team.coach) {
    return res
      .status(400)
      .json({ error: "Name, state, district, and coach are required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const eventDoc = await db.collection("events").doc(eventId).get();
    if (!eventDoc.exists)
      return res.status(400).json({ error: "Selected event does not exist." });
    const docRef = await db.collection("teams").add(team);
    res.status(201).json({ id: docRef.id, ...team });
  } catch (error) {
    console.error(
      "Firestore Error in addTeam, using memory fallback:",
      error.message,
    );
    if (!ensureEventInMemory(eventId)) {
      return res.status(400).json({ error: "Selected event does not exist." });
    }
    const newTeam = { id: generateId(), ...team };
    mutateFallbackStore((store) => {
      store.teams.push(newTeam);
      return store;
    });
    res.status(201).json(newTeam);
  }
};

const updateTeam = async (req, res) => {
  const { id } = req.params;
  const updates = {
    name: normalizeString(req.body.name),
    state: normalizeString(req.body.state),
    district: normalizeString(req.body.district),
    coach: normalizeString(req.body.coach),
  };

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const teamRef = db.collection("teams").doc(id);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: "Team not found." });
    }
    await teamRef.update(updates);
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updateTeam, using memory fallback:",
      error.message,
    );
    let updated = false;
    mutateFallbackStore((store) => {
      const index = store.teams.findIndex((team) => team.id === id);
      if (index === -1) return store;
      store.teams[index] = { ...store.teams[index], ...updates };
      updated = true;
      return store;
    });
    if (!updated) return res.status(404).json({ error: "Team not found." });
    res.json({ success: true });
  }
};

const deleteTeam = async (req, res) => {
  const { id } = req.params;

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const teamRef = db.collection("teams").doc(id);
    const teamDoc = await teamRef.get();
    if (!teamDoc.exists) {
      return res.status(404).json({ error: "Team not found." });
    }

    const [playersSnapshot, matchesSnapshot] = await Promise.all([
      db.collection("players").where("teamId", "==", id).get(),
      db.collection("matches").where("teamIds", "array-contains", id).get(),
    ]);

    const batch = db.batch();
    playersSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    matchesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(teamRef);
    await batch.commit();

    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deleteTeam, using memory fallback:",
      error.message,
    );
    let deleted = false;
    mutateFallbackStore((store) => {
      const exists = store.teams.some((team) => team.id === id);
      if (!exists) return store;
      store.teams = store.teams.filter((team) => team.id !== id);
      store.players = store.players.filter((player) => player.teamId !== id);
      store.matches = store.matches.filter(
        (match) => ![match.teamAId, match.teamBId].includes(id),
      );
      deleted = true;
      return store;
    });
    if (!deleted) return res.status(404).json({ error: "Team not found." });
    res.json({ success: true });
  }
};

// Players
const getPlayers = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  try {
    if (!db) throw new Error("Database not initialized");
    let query = db.collection("players");
    if (eventId) query = query.where("eventId", "==", eventId);
    const snapshot = await query.get();
    const players = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(players);
  } catch (error) {
    console.error(
      "Firestore Error in getPlayers, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    const players = eventId
      ? memoryDB.players.filter((player) => player.eventId === eventId)
      : memoryDB.players;
    res.json(players);
  }
};

const addPlayer = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId)
    return res.status(400).json({ error: "Event selection is required." });

  const player = {
    name: normalizeString(req.body.name),
    email: normalizeString(req.body.email).toLowerCase(),
    phone: normalizePhone(req.body.phone),
    age: Number(req.body.age),
    weight: Number(req.body.weight),
    position: normalizeString(req.body.position),
    teamId: normalizeString(req.body.teamId),
    dob: normalizeString(req.body.dob),
    aadhar: normalizeString(req.body.aadhar),
    photoUrl: normalizeString(req.body.photoUrl),
    eventId,
    createdAt: new Date().toISOString(),
  };

  if (!player.name || !player.teamId || !player.position || !player.photoUrl) {
    return res.status(400).json({ error: "Missing required player fields." });
  }

  if (!player.email || !/^\S+@\S+\.\S+$/.test(player.email)) {
    return res
      .status(400)
      .json({ error: "A valid email address is required." });
  }

  if (!/^\d{10}$/.test(player.phone)) {
    return res
      .status(400)
      .json({ error: "A valid 10-digit phone number is required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const teamDoc = await db.collection("teams").doc(player.teamId).get();
    if (!teamDoc.exists || teamDoc.data().eventId !== eventId) {
      return res
        .status(400)
        .json({ error: "Selected team is not part of this event." });
    }
    const docRef = await db.collection("players").add(player);
    res.status(201).json({ id: docRef.id, ...player });
  } catch (error) {
    console.error(
      "Firestore Error in addPlayer, using memory fallback:",
      error.message,
    );
    const team = memoryDB.teams.find(
      (entry) => entry.id === player.teamId && entry.eventId === eventId,
    );
    if (!team)
      return res
        .status(400)
        .json({ error: "Selected team is not part of this event." });
    const newPlayer = { id: generateId(), ...player };
    mutateFallbackStore((store) => {
      store.players.push(newPlayer);
      return store;
    });
    res.status(201).json(newPlayer);
  }
};

const updatePlayer = async (req, res) => {
  const { id } = req.params;
  const updates = {
    name: normalizeString(req.body.name),
    email: normalizeString(req.body.email).toLowerCase(),
    phone: normalizePhone(req.body.phone),
    age: req.body.age === undefined ? undefined : Number(req.body.age),
    weight: req.body.weight === undefined ? undefined : Number(req.body.weight),
    position: normalizeString(req.body.position),
    teamId: normalizeString(req.body.teamId),
    dob: normalizeString(req.body.dob),
    aadhar: normalizeString(req.body.aadhar),
    photoUrl: normalizeString(req.body.photoUrl),
  };

  if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email)) {
    return res
      .status(400)
      .json({ error: "A valid email address is required." });
  }
  if (updates.phone && !/^\d{10}$/.test(updates.phone)) {
    return res
      .status(400)
      .json({ error: "A valid 10-digit phone number is required." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const playerRef = db.collection("players").doc(id);
    const playerDoc = await playerRef.get();
    if (!playerDoc.exists) {
      return res.status(404).json({ error: "Player not found." });
    }
    const payload = Object.fromEntries(
      Object.entries(updates).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    );
    await playerRef.update(payload);
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updatePlayer, using memory fallback:",
      error.message,
    );
    let updated = false;
    mutateFallbackStore((store) => {
      const index = store.players.findIndex((player) => player.id === id);
      if (index === -1) return store;
      store.players[index] = { ...store.players[index], ...updates };
      updated = true;
      return store;
    });
    if (!updated) return res.status(404).json({ error: "Player not found." });
    res.json({ success: true });
  }
};

const deletePlayer = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    await db.collection("players").doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deletePlayer, using memory fallback:",
      error.message,
    );
    const before = memoryDB.players.length;
    mutateFallbackStore((store) => {
      store.players = store.players.filter((player) => player.id !== id);
      return store;
    });
    res.json({ success: before !== memoryDB.players.length });
  }
};

// Matches
const generateFixtures = async (req, res) => {
  const eventId = getEventIdFromReq(req);
  if (!eventId)
    return res.status(400).json({ error: "Event selection is required." });

  let inputTeams = Array.isArray(req.body.teams) ? req.body.teams : [];
  if (!inputTeams.length) {
    inputTeams = memoryDB.teams.filter((team) => team.eventId === eventId);
  }

  if (inputTeams.length < 2) {
    return res
      .status(400)
      .json({ error: "At least 2 teams are required to generate fixtures." });
  }

  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    if (!Array.isArray(req.body.teams) || !req.body.teams.length) {
      const snapshot = await db
        .collection("teams")
        .where("eventId", "==", eventId)
        .get();
      inputTeams = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
    const { fixtures } = genFix(inputTeams);
    const batch = db.batch();
    fixtures.forEach((fixture) => {
      const ref = db.collection("matches").doc(fixture.id);
      batch.set(ref, {
        ...fixture,
        eventId,
        createdAt: new Date().toISOString(),
      });
    });
    await batch.commit();
    res.json({ fixtures });
  } catch (error) {
    console.error(
      "Firestore Error in generateFixtures, using memory fallback:",
      error.message,
    );
    const { fixtures } = genFix(inputTeams);
    const payload = fixtures.map((fixture) => ({
      ...fixture,
      eventId,
      createdAt: new Date().toISOString(),
    }));
    mutateFallbackStore((store) => {
      store.matches.push(...payload);
      return store;
    });
    res.json({ fixtures: payload });
  }
};

const getMatches = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  try {
    if (!db) throw new Error("Database not initialized");
    let query = db.collection("matches");
    if (eventId) query = query.where("eventId", "==", eventId);
    const snapshot = await query.get();
    const matches = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(matches);
  } catch (error) {
    console.error(
      "Firestore Error in getMatches, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    const matches = eventId
      ? memoryDB.matches.filter((match) => match.eventId === eventId)
      : memoryDB.matches;
    res.json(matches);
  }
};

const updateMatch = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    await db.collection("matches").doc(id).update(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in updateMatch, using memory fallback:",
      error.message,
    );
    mutateFallbackStore((store) => {
      const index = store.matches.findIndex((match) => match.id === id);
      if (index !== -1) {
        store.matches[index] = { ...store.matches[index], ...req.body };
      }
      return store;
    });
    res.json({ success: true });
  }
};

const deleteMatch = async (req, res) => {
  const { id } = req.params;
  try {
    if (!db) throw new Error("Firestore Database not initialized.");
    const matchRef = db.collection("matches").doc(id);
    const matchDoc = await matchRef.get();
    if (!matchDoc.exists) {
      return res.status(404).json({ error: "Match not found." });
    }
    await matchRef.delete();
    res.json({ success: true });
  } catch (error) {
    console.error(
      "Firestore Error in deleteMatch, using memory fallback:",
      error.message,
    );
    let deleted = false;
    mutateFallbackStore((store) => {
      const exists = store.matches.some((match) => match.id === id);
      if (!exists) return store;
      store.matches = store.matches.filter((match) => match.id !== id);
      deleted = true;
      return store;
    });
    if (!deleted) return res.status(404).json({ error: "Match not found." });
    res.json({ success: true });
  }
};

const getLiveMatch = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  try {
    if (!db) throw new Error("Database not initialized");
    let query = db.collection("matches").orderBy("createdAt", "desc");
    if (eventId) query = query.where("eventId", "==", eventId);
    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return res.status(404).json({ error: "No matches" });
    res.json({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
  } catch (error) {
    console.error(
      "Firestore Error in getLiveMatch, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    const matches = eventId
      ? memoryDB.matches.filter((match) => match.eventId === eventId)
      : memoryDB.matches;
    if (!matches.length)
      return res.status(404).json({ error: "No matches available" });
    res.json(matches[matches.length - 1]);
  }
};

// Stats
const getStats = async (req, res) => {
  const eventId = normalizeString(req.query.eventId);
  try {
    if (!db) throw new Error("Database not initialized");

    if (!eventId) {
      const [events, teams, players, matches] = await Promise.all([
        db.collection("events").count().get(),
        db.collection("teams").count().get(),
        db.collection("players").count().get(),
        db.collection("matches").count().get(),
      ]);

      const teamDocs = await db.collection("teams").get();
      const districts = new Set(
        teamDocs.docs.map((doc) => doc.data().district).filter(Boolean),
      );

      return res.json({
        events: events.data().count,
        teams: teams.data().count,
        players: players.data().count,
        matches: matches.data().count,
        districts: districts.size,
      });
    }

    const [teamsSnapshot, playersSnapshot, matchesSnapshot] = await Promise.all(
      [
        db.collection("teams").where("eventId", "==", eventId).get(),
        db.collection("players").where("eventId", "==", eventId).get(),
        db.collection("matches").where("eventId", "==", eventId).get(),
      ],
    );

    const districts = new Set(
      teamsSnapshot.docs.map((doc) => doc.data().district).filter(Boolean),
    );

    return res.json({
      events: 1,
      teams: teamsSnapshot.size,
      players: playersSnapshot.size,
      matches: matchesSnapshot.size,
      districts: districts.size,
    });
  } catch (error) {
    console.error(
      "Firestore Error in getStats, using memory fallback:",
      error.message,
    );
    memoryDB = readFallbackStore();
    const teams = eventId
      ? memoryDB.teams.filter((entry) => entry.eventId === eventId)
      : memoryDB.teams;
    const players = eventId
      ? memoryDB.players.filter((entry) => entry.eventId === eventId)
      : memoryDB.players;
    const matches = eventId
      ? memoryDB.matches.filter((entry) => entry.eventId === eventId)
      : memoryDB.matches;
    const districts = new Set(
      teams.map((entry) => entry.district).filter(Boolean),
    );

    res.json({
      events: eventId ? 1 : memoryDB.events.length,
      teams: teams.length,
      players: players.length,
      matches: matches.length,
      districts: districts.size,
    });
  }
};

module.exports = {
  getLocationOptions,
  detectLocationFromIp,
  getEvents,
  addEvent,
  updateEvent,
  deleteEvent,
  activateEvent,
  getTeams,
  addTeam,
  updateTeam,
  deleteTeam,
  getPlayers,
  addPlayer,
  updatePlayer,
  deletePlayer,
  generateFixtures,
  getMatches,
  updateMatch,
  deleteMatch,
  getLiveMatch,
  getStats,
};
