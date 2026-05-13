const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

export const normalizeText = (value) => String(value ?? "").trim();

export const normalizeEmail = (value) => normalizeText(value).toLowerCase();

export const normalizePhone = (value) =>
  normalizeText(value).replace(/\D/g, "");

export const normalizeAadhar = (value) =>
  normalizeText(value).replace(/\D/g, "");

export const normalizeDob = (value) => {
  const text = normalizeText(value);
  if (!text) return "";
  const parsed = new Date(`${text}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "" : text.slice(0, 10);
};

export const calculateAgeFromDob = (dobValue, referenceDate = new Date()) => {
  const normalizedDob = normalizeDob(dobValue);
  if (!normalizedDob) return null;

  const birthDate = new Date(`${normalizedDob}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && referenceDate.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age;
};

export const buildPlayerPayload = (player) => ({
  eventId: normalizeText(player.eventId),
  name: normalizeText(player.name),
  fatherName: normalizeText(player.fatherName),
  email: normalizeEmail(player.email),
  phone: normalizePhone(player.phone),
  age:
    player.age === "" || player.age === null || player.age === undefined
      ? ""
      : Number(player.age),
  weight:
    player.weight === "" ||
    player.weight === null ||
    player.weight === undefined
      ? ""
      : Number(player.weight),
  position: normalizeText(player.position),
  teamId: normalizeText(player.teamId),
  district: normalizeText(player.district),
  state: normalizeText(player.state),
  dob: normalizeDob(player.dob),
  aadhar: normalizeAadhar(player.aadhar),
  aadharFrontUrl: normalizeText(player.aadharFrontUrl),
  aadharBackUrl: normalizeText(player.aadharBackUrl),
  photoUrl: normalizeText(player.photoUrl),
  photoPublicId: normalizeText(player.photoPublicId),
});

const describeConflict = (fieldLabel, messageSuffix = "") => {
  if (messageSuffix) {
    return `${fieldLabel} ${messageSuffix}`;
  }
  return `${fieldLabel} is already registered.`;
};

export const validatePlayerIdentity = ({
  player,
  existingPlayers = [],
  editingPlayerId = "",
}) => {
  const normalized = buildPlayerPayload(player);
  const candidates = existingPlayers.filter(
    (entry) => entry?.id !== editingPlayerId,
  );

  if (!normalized.eventId) {
    return { ok: false, message: "Please select an event first." };
  }
  if (!normalized.name) {
    return { ok: false, message: "Player name is required." };
  }
  if (!normalized.teamId) {
    return { ok: false, message: "Please select a team." };
  }
  if (!normalized.email || !EMAIL_PATTERN.test(normalized.email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (!normalized.phone || normalized.phone.length !== 10) {
    return { ok: false, message: "Enter a valid 10-digit phone number." };
  }
  if (!normalized.aadhar || normalized.aadhar.length !== 12) {
    return { ok: false, message: "Enter a valid 12-digit Aadhaar number." };
  }
  if (!normalized.dob) {
    return { ok: false, message: "Date of birth is required." };
  }

  const calculatedAge = calculateAgeFromDob(normalized.dob);
  if (calculatedAge === null) {
    return { ok: false, message: "Enter a valid date of birth." };
  }
  if (Number.isNaN(normalized.age)) {
    return { ok: false, message: "Enter the current age." };
  }
  if (normalized.age !== calculatedAge) {
    return {
      ok: false,
      message: "Age does not match the selected date of birth.",
    };
  }

  const sameAadhar = candidates.find(
    (entry) => normalizeAadhar(entry?.aadhar) === normalized.aadhar,
  );
  if (sameAadhar) {
    if (normalizeDob(sameAadhar.dob) !== normalized.dob) {
      return {
        ok: false,
        message: describeConflict(
          "Aadhaar number",
          "is already tied to a different date of birth.",
        ),
      };
    }

    return {
      ok: false,
      message: describeConflict("Aadhaar number"),
    };
  }

  const sameEmail = candidates.find(
    (entry) => normalizeEmail(entry?.email) === normalized.email,
  );
  if (sameEmail) {
    if (normalizeDob(sameEmail.dob) !== normalized.dob) {
      return {
        ok: false,
        message: describeConflict(
          "Email address",
          "is already tied to a different date of birth.",
        ),
      };
    }

    return {
      ok: false,
      message: describeConflict("Email address"),
    };
  }

  const sameContactProfile = candidates.find((entry) => {
    const sameName =
      normalizeText(entry?.name).toLowerCase() ===
      normalized.name.toLowerCase();
    const samePhone = normalizePhone(entry?.phone) === normalized.phone;
    return sameName && samePhone && normalizeDob(entry?.dob) !== normalized.dob;
  });
  if (sameContactProfile) {
    return {
      ok: false,
      message: "Player details conflict with an existing record.",
    };
  }

  return {
    ok: true,
    normalized,
    calculatedAge,
  };
};
