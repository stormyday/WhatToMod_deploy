import { describe, it, expect } from 'vitest';
import { groupProfessorsBySemester } from '../../src/components/SentAnalysis/aspectBreakdownHelpers';

describe('groupProfessorsBySemester', () => {
  it('groups professors under their semester', () => {
    const input = [
      { name: 'Dr Tan', semester: 'Semester 1', mentionCount: 3 },
      { name: 'Dr Lim', semester: 'Semester 2', mentionCount: 1 },
    ];
    expect(groupProfessorsBySemester(input)).toEqual({
      'Semester 1': [{ name: 'Dr Tan', semester: 'Semester 1', mentionCount: 3 }],
      'Semester 2': [{ name: 'Dr Lim', semester: 'Semester 2', mentionCount: 1 }],
    });
  });

  it('buckets missing or "Unclear" semesters under "Semester unclear"', () => {
    const input = [
      { name: 'Dr Tan', semester: 'Unclear', mentionCount: 2 },
      { name: 'Dr Lim', semester: null, mentionCount: 1 },
    ];
    const grouped = groupProfessorsBySemester(input);
    expect(Object.keys(grouped)).toEqual(['Semester unclear']);
    expect(grouped['Semester unclear']).toHaveLength(2);
  });

  it('returns an empty object for no input', () => {
    expect(groupProfessorsBySemester()).toEqual({});
    expect(groupProfessorsBySemester([])).toEqual({});
  });
});
