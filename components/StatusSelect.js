"use client";

// Full class names (no concatenation) so that Tailwind detects them.
export const TONES = {
  orange: {
    select: "bg-orange-50 text-orange-800 ring-orange-200",
    dot: "bg-orange-500",
  },
  green: {
    select: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  red: {
    select: "bg-red-50 text-red-800 ring-red-200",
    dot: "bg-red-500",
  },
  gray: {
    select: "bg-gray-100 text-gray-700 ring-gray-300",
    dot: "bg-gray-400",
  },
  blue: {
    select: "bg-sky-50 text-sky-800 ring-sky-200",
    dot: "bg-sky-500",
  },
};

export default function StatusSelect({
  value,
  options,
  onChange,
  label,
  disabled = false,
  widthClassName = "w-44",
}) {
  const current = options.find((option) => option.value === value);
  const tone = TONES[current?.tone] ?? TONES.orange;

  return (
    <div className={`relative inline-block ${widthClassName}`}>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full ${tone.dot}`}
      />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`w-full cursor-pointer appearance-none rounded-full py-1.5 pl-7 pr-8 text-base font-medium ring-1 sm:text-sm ring-inset transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${tone.select}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60"
      >
        <path
          fillRule="evenodd"
          d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
