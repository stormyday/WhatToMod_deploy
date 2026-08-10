import { describe, it, expect } from 'vitest';
import { computeGpa, GRADE_POINTS } from '../../src/utils/gpa';

describe('computeGpa', () => {
  it('returns null cap when no rows are counted', () => {
    expect(computeGpa([])).toEqual({ cap: null, countedMcs: 0, suMcs: 0 });
  });

  it('computes a weighted average across graded modules', () => {
    const rows = [
      { moduleCode: 'CS1010', grade: 'A', mc: '4', su: false },
      { moduleCode: 'CS2030', grade: 'B+', mc: '4', su: false },
    ];
    const { cap, countedMcs } = computeGpa(rows);
    const expected = (GRADE_POINTS['A'] * 4 + GRADE_POINTS['B+'] * 4) / 8;
    expect(cap).toBeCloseTo(expected);
    expect(countedMcs).toBe(8);
  });

  it('excludes S/U rows from GPA but tracks their MCs separately', () => {
    const rows = [
      { moduleCode: 'CS1010', grade: 'A', mc: '4', su: false },
      { moduleCode: 'CS2030', grade: 'C', mc: '4', su: true },
    ];
    const { cap, countedMcs, suMcs } = computeGpa(rows);
    expect(cap).toBe(GRADE_POINTS['A']);
    expect(countedMcs).toBe(4);
    expect(suMcs).toBe(4);
  });

  it('ignores rows missing a grade, an invalid MC, or an unrecognised grade', () => {
    const rows = [
      { moduleCode: 'CS1010', grade: '', mc: '4', su: false },
      { moduleCode: 'CS2030', grade: 'A', mc: '', su: false },
      { moduleCode: 'CS2040', grade: 'A', mc: '0', su: false },
      { moduleCode: 'CS2100', grade: 'Z', mc: '4', su: false },
    ];
    expect(computeGpa(rows)).toEqual({ cap: null, countedMcs: 0, suMcs: 0 });
  });
});
