export const officialRoles = [
  {
    id: "chief-referee",
    title: "Referee",
    count: 1,
    station: "Central control table",
    authority: "Final decision, toss, match start/end, cards, disputed points",
    tools: [
      "Start clock",
      "End raid",
      "Override point",
      "Issue cards",
      "Approve result",
    ],
  },
  {
    id: "umpire-1",
    title: "Umpire 1",
    count: 1,
    station: "Mid-line, Team A side",
    authority: "Cant, baulk line, bonus line, touches, struggle decisions",
    tools: [
      "Touch point",
      "Bonus point",
      "Tackle validation",
      "Technical violation",
    ],
  },
  {
    id: "umpire-2",
    title: "Umpire 2",
    count: 1,
    station: "Mid-line, Team B side",
    authority: "Cant, baulk line, bonus line, touches, struggle decisions",
    tools: [
      "Touch point",
      "Bonus point",
      "Tackle validation",
      "Technical violation",
    ],
  },
  {
    id: "chief-scorer",
    title: "Scorer",
    count: 1,
    station: "Official scorer table",
    authority: "Primary legal score sheet, running score, match summary",
    tools: [
      "Cross and circle score",
      "Technical points",
      "Half-time check",
      "Final validation",
    ],
  },
  {
    id: "asst-scorer-1",
    title: "Assistant Scorer A",
    count: 1,
    station: "Team A waiting block",
    authority: "Team A out queue, revival sequence, entry/exit sequence",
    tools: [
      "Mark out",
      "Revive first-out player",
      "Substitution sequence",
      "Bench audit",
    ],
  },
  {
    id: "asst-scorer-2",
    title: "Assistant Scorer B",
    count: 1,
    station: "Team B waiting block",
    authority: "Team B out queue, revival sequence, entry/exit sequence",
    tools: [
      "Mark out",
      "Revive first-out player",
      "Substitution sequence",
      "Bench audit",
    ],
  },
];

export const scoreSheetSections = [
  "Administrative Data",
  "Team Rosters",
  "Running Score",
  "Individual Performance",
  "Discipline",
  "Match Summary",
  "Signatures",
];
// Public lists and examples used by the frontend.
// Remove hard-coded demo entries here and populate at runtime from your API/backend.

/**
 * districts: an array of district names used for team registration.
 * Keep empty in code and provide values from a backend or admin UI.
 * Example structure (commented):
 * export const districts = ['Ranchi', 'Dhanbad', 'Bokaro'];
 */
export const districts = [];

/**
 * Player lists and performance rows are intentionally empty here.
 * The frontend will render friendly messages when these are not present.
 */
export const samplePlayersA = [];
export const samplePlayersB = [];
export const performanceRows = [];
