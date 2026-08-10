import { describe, it, expect } from 'vitest';
import { semesterLabel, groupRelatedModulesByName } from '../../src/components/SentAnalysis/lecturerPageHelpers';

describe('semesterLabel', () => {
  it('joins known semesters with a comma', () => {
    expect(semesterLabel(['Semester 1', 'Semester 2'])).toBe('Semester 1, Semester 2');
  });

  it('filters out "Unclear" entries before joining', () => {
    expect(semesterLabel(['Semester 1', 'Unclear'])).toBe('Semester 1');
  });

  it('falls back to "Semester unclear" when nothing is known', () => {
    expect(semesterLabel(['Unclear'])).toBe('Semester unclear');
    expect(semesterLabel([])).toBe('Semester unclear');
  });
});

describe('groupRelatedModulesByName', () => {
  it('groups entries by name, preserving each group\'s order', () => {
    const input = [
      { name: 'Dr Tan', moduleCode: 'CS1010' },
      { name: 'Dr Lim', moduleCode: 'CS2030' },
      { name: 'Dr Tan', moduleCode: 'CS2040' },
    ];
    expect(groupRelatedModulesByName(input)).toEqual({
      'Dr Tan': [
        { name: 'Dr Tan', moduleCode: 'CS1010' },
        { name: 'Dr Tan', moduleCode: 'CS2040' },
      ],
      'Dr Lim': [{ name: 'Dr Lim', moduleCode: 'CS2030' }],
    });
  });

  it('returns an empty object for no input', () => {
    expect(groupRelatedModulesByName()).toEqual({});
    expect(groupRelatedModulesByName([])).toEqual({});
  });
});
