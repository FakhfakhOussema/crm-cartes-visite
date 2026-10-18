const STYLES = {
  short: { day: "numeric", month: "short", year: "numeric" }, // "12 Oct 2026"
  long: { day: "numeric", month: "long", year: "numeric" }, // "12 October 2026"
  numeric: { day: "2-digit", month: "2-digit", year: "numeric" }, // "12/10/2026"
};

const formatters = new Map();

function getFormatter(style, timeZone) {
  const key = `${style}|${timeZone}`;
  if (!formatters.has(key)) {
    formatters.set(
      key,
      new Intl.DateTimeFormat("en-GB", { ...STYLES[style], timeZone }),
    );
  }
  return formatters.get(key);
}

// Formats `date_ajout` as returned by Supabase: either a plain date ("2026-10-12", read as UTC so it does not
// shift by a day) or a timestamp ("2026-10-12T22:30:00+00:00", shown in the user's time zone).
// Returns "" if the value is empty or invalid.
export function formatDate(isoDate, style = "short") {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  const timeZone = isoDate.length > 10 ? undefined : "UTC";
  return getFormatter(style, timeZone).format(date);
}
