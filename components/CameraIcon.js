// Camera outline icon (decorative: the button that holds it carries the label).
export default function CameraIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6.83 6.18A2.31 2.31 0 0 1 5.19 7.23c-.38.05-.76.11-1.14.18C3 7.58 2.25 8.51 2.25 9.57V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.57c0-1.06-.75-1.99-1.8-2.16-.38-.07-.75-.13-1.13-.18a2.31 2.31 0 0 1-1.64-1.05l-.82-1.32a2.19 2.19 0 0 0-1.74-1.04 48.8 48.8 0 0 0-5.23 0 2.19 2.19 0 0 0-1.74 1.04l-.82 1.32Z" />
      <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  );
}
