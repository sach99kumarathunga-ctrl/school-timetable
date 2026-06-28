// Maps internal bucket colour keys (from the Excel) to display hex colours,
// chosen to resemble the original template fills.
export const BUCKET_COLORS = {
  "rgb:FFFFFF00": "#FFF275",   // yellow bucket
  "t9_0.60": "#9DC3E6",        // light blue (Sinhala/Tamil)
  "rgb:FF7030A0": "#B4A7D6",   // purple (Little Friends / Cub Scouts)
  "t4_0.60": "#B4A7D6",        // purple variant
  "t7_0.60": "#A9D08E",        // green (Western Music/French, or teal arts)
  "t6_0.60": "#C6E0B4",        // light green (Civics/Cookery/Tech)
  "RELIGION": "#F4B183",       // orange (religion block)
  "none": "#FFFFFF",           // white = main subject
};

export const ASSEMBLY_COLOR = "#D9D9D9";
export const INTERVAL_COLOR = "#404040";

export function colorFor(bucketId) {
  if (!bucketId) return "#FFFFFF";
  return BUCKET_COLORS[bucketId] || "#FCE4D6";
}
