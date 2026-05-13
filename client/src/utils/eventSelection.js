export const ACTIVE_EVENT_KEY = "kms_active_event";
export const EVENT_CHANGE_EVENT = "kms:event-change";

export const getActiveEventId = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_EVENT_KEY) || "";
};

export const setActiveEventId = (eventId) => {
  if (typeof window === "undefined") return;
  const nextId = eventId || "";
  window.localStorage.setItem(ACTIVE_EVENT_KEY, nextId);
  window.dispatchEvent(
    new CustomEvent(EVENT_CHANGE_EVENT, {
      detail: { eventId: nextId },
    }),
  );
};
