export const GRADE_POINTS = {
  "A+": 5.0, "A": 5.0, "A-": 4.5,
  "B+": 4.0, "B": 3.5, "B-": 3.0,
  "C+": 2.5, "C": 2.0,
  "D+": 1.5, "D": 1.0,
  "F": 0.0,
};

export function computeGpa(rows) {
  let points = 0, mcs = 0, suMcTotal = 0;
  for (const row of rows) {
    const mc = parseFloat(row.mc);
    if (!row.grade || !Number.isFinite(mc) || mc <= 0) continue;
    if (row.su) { suMcTotal += mc; continue; }
    const gp = GRADE_POINTS[row.grade];
    if (gp === undefined) continue;
    points += gp * mc;
    mcs += mc;
  }
  return {
    cap: mcs > 0 ? points / mcs : null,
    countedMcs: mcs,
    suMcs: suMcTotal,
  };
}
