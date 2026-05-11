/**
 * Map a 0–100 SEO score to a letter grade. More visceral than the raw
 * number for cold-outreach recipients ("You're a D+" hits harder than
 * "You're at 67/100").
 */
export type LetterGrade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

export function letterGrade(score: number): LetterGrade {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "B+";
  if (score >= 80) return "B";
  if (score >= 75) return "C+";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case "A+":
    case "A":
      return "#10b981"; // emerald-500
    case "B+":
    case "B":
      return "#22c55e"; // green-500
    case "C+":
    case "C":
      return "#f59e0b"; // amber-500
    case "D":
      return "#f97316"; // orange-500
    case "F":
      return "#ef4444"; // red-500
  }
}

export function gradeNarrative(grade: LetterGrade): string {
  switch (grade) {
    case "A+":
      return "Excellent — your SEO fundamentals are dialed in.";
    case "A":
      return "Strong — minor polish opportunities only.";
    case "B+":
      return "Solid, but a handful of quick wins are sitting on the table.";
    case "B":
      return "Above average — fix the warnings to outrank competitors.";
    case "C+":
      return "Mediocre — search engines are rewarding competitors over you.";
    case "C":
      return "Below average. Several issues are actively hurting your rankings.";
    case "D":
      return "Poor. Search visibility is being dragged down by fixable basics.";
    case "F":
      return "Critical. Your site is invisible to most search crawlers.";
  }
}
