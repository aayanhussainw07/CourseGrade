export const HEADER_COLOR_OPTIONS = [
  { id: "none", label: "None", color: "" },
  { id: "grey", label: "Grey", color: "#6b7280" },
  { id: "black", label: "Black", color: "#111827" },
  { id: "red", label: "Red", color: "#b91c1c" },
  { id: "orange", label: "Orange", color: "#c2410c" },
  { id: "amber", label: "Amber", color: "#b45309" },
  { id: "yellow", label: "Yellow", color: "#ca8a04" },
  { id: "lime", label: "Lime", color: "#65a30d" },
  { id: "green", label: "Green", color: "#16a34a" },
  { id: "teal", label: "Teal", color: "#0d9488" },
  { id: "cyan", label: "Cyan", color: "#0891b2" },
  { id: "blue", label: "Blue", color: "#2563eb" },
  { id: "indigo", label: "Indigo", color: "#4f46e5" },
  { id: "purple", label: "Purple", color: "#7c3aed" },
  { id: "pink", label: "Pink", color: "#db2777" },
] as const;

const RANDOM_HEADER_COLORS = HEADER_COLOR_OPTIONS
  .map((option) => option.color)
  .filter((color) => color.length > 0);

export const getRandomHeaderColor = () => {
  const index = Math.floor(Math.random() * RANDOM_HEADER_COLORS.length);
  return RANDOM_HEADER_COLORS[index] ?? "";
};
