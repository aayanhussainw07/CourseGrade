// Maps a Cornell subject code (e.g. "CS", "AAP", "MATH") to a chip color used
// behind the course code on the roster. Well-known subjects get a hand-picked
// hue based on what the field is commonly associated with; anything not listed
// falls back to a deterministic palette pick so its color stays stable.

export type SubjectChip = { bg: string; fg: string };

// Soft tint background + readable dark foreground.
const C = {
  blue: { bg: "#dbeafe", fg: "#1d4ed8" },
  sky: { bg: "#e0f2fe", fg: "#0369a1" },
  cyan: { bg: "#cffafe", fg: "#0e7490" },
  teal: { bg: "#ccfbf1", fg: "#0f766e" },
  emerald: { bg: "#d1fae5", fg: "#047857" },
  green: { bg: "#dcfce7", fg: "#15803d" },
  lime: { bg: "#ecfccb", fg: "#4d7c0f" },
  amber: { bg: "#fef3c7", fg: "#b45309" },
  orange: { bg: "#ffedd5", fg: "#c2410c" },
  red: { bg: "#fee2e2", fg: "#b91c1c" },
  rose: { bg: "#ffe4e6", fg: "#be123c" },
  pink: { bg: "#fce7f3", fg: "#be185d" },
  fuchsia: { bg: "#fae8ff", fg: "#a21caf" },
  purple: { bg: "#f3e8ff", fg: "#7e22ce" },
  violet: { bg: "#ede9fe", fg: "#6d28d9" },
  indigo: { bg: "#e0e7ff", fg: "#4338ca" },
  slate: { bg: "#e2e8f0", fg: "#334155" },
  stone: { bg: "#e7e5e4", fg: "#57534e" },
  brown: { bg: "#ecddd0", fg: "#8a5a36" },
} satisfies Record<string, SubjectChip>;

const FALLBACK: SubjectChip[] = [
  C.blue, C.teal, C.amber, C.violet, C.rose, C.lime,
  C.cyan, C.orange, C.indigo, C.emerald, C.fuchsia, C.sky,
];

// Exact subject-code → color. Grouped by association.
const EXACT: Record<string, SubjectChip> = {
  // Computing / info → blue family
  CS: C.blue, INFO: C.sky, ORIE: C.orange, ECE: C.indigo,
  // Math / stats → violet family
  MATH: C.violet, STSCI: C.violet, BTRY: C.violet,
  // Physical sciences
  PHYS: C.indigo, ASTRO: C.indigo, CHEM: C.teal, EAS: C.sky,
  // Life sciences → green
  BIOG: C.green, BIOMG: C.green, BIOEE: C.green, BIONB: C.green,
  BIOMI: C.green, BIOAP: C.green, NS: C.green, NTRES: C.green,
  PLSCI: C.lime, HORT: C.lime, ENTOM: C.lime, ANSC: C.brown,
  // Architecture, Art & Planning → drafting slate / art fuchsia
  AAP: C.slate, ARCH: C.slate, ART: C.fuchsia, CRP: C.slate,
  DEA: C.amber, // design + environmental analysis
  // Humanities
  ENGL: C.amber, HIST: C.brown, PHIL: C.stone, CLASS: C.brown,
  RELST: C.stone, COML: C.amber,
  // Social sciences
  ECON: C.emerald, GOVT: C.indigo, PSYCH: C.rose, SOC: C.rose,
  ANTHR: C.brown, COMM: C.cyan, PAM: C.emerald, DSOC: C.rose,
  // Business
  AEM: C.emerald, NBA: C.slate, HADM: C.teal,
  // Arts / performance
  MUSIC: C.purple, PMA: C.purple, // performing & media arts
  // Engineering
  MAE: C.orange, CHEME: C.orange, CEE: C.orange, BEE: C.orange,
  MSE: C.orange, ENGRD: C.orange, ENGRI: C.orange, SYSEN: C.orange,
  // Health / human dev
  HD: C.teal, NUTR: C.green, VETMED: C.green,
  // Law
  LAW: C.red,
};

// Code prefixes that all share a color (e.g. all BIO* → green).
const PREFIX: { test: RegExp; chip: SubjectChip }[] = [
  { test: /^BIO/, chip: C.green },
  { test: /^CHEM/, chip: C.teal },
  { test: /^PHYS/, chip: C.indigo },
  { test: /^MATH/, chip: C.violet },
  { test: /^CS/, chip: C.blue },
  { test: /^ENGR/, chip: C.orange },
  // Languages → rose
  {
    test: /^(SPAN|FREN|GERST|ITAL|CHIN|JAPAN|RUSSL|LATIN|GREEK|ARAB|KOREA|PORT|HEBRW|HINDI|VIET|SWAHL|TURK|PERSN)/,
    chip: C.rose,
  },
];

export function getSubjectChip(subject: string): SubjectChip {
  const key = (subject || "").trim().toUpperCase();
  if (!key) return C.slate;
  if (EXACT[key]) return EXACT[key];
  for (const p of PREFIX) if (p.test.test(key)) return p.chip;
  // Deterministic fallback so each unmapped subject keeps a stable color.
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
