import { describe, it, expect } from 'vitest';
import { inferTags, extractRelevantContent } from '../../src/components/SentAnalysis/reviewTagging';

describe('inferTags', () => {
  it('tags text mentioning workload-related keywords', () => {
    expect(inferTags('The weekly assignment took 10 hours')).toContain('Workload');
  });

  it('tags text mentioning difficulty-related keywords', () => {
    expect(inferTags('The content was really hard and challenging')).toContain('Difficulty');
  });

  it('falls back to General when nothing matches', () => {
    expect(inferTags('This module was fine, nothing much to say.')).toEqual(['General']);
  });

  it('can return multiple tags when several categories match', () => {
    const tags = inferTags('Heavy workload but the exam was fair, tip: attend every lecture');
    expect(tags).toEqual(expect.arrayContaining(['Workload', 'Assessment', 'Tips']));
  });

  it('matching is case-insensitive', () => {
    expect(inferTags('HARD AND CHALLENGING CONTENT')).toContain('Difficulty');
  });
});

describe('extractRelevantContent', () => {
  const text = [
    'Overall a decent module.',
    '',
    'The workload was heavy, expect 10 hours a week.',
    '',
    'The final exam was fair and well-paced.',
  ].join('\n');

  it('returns the full text unchanged for the "All" filter', () => {
    expect(extractRelevantContent(text, 'All')).toBe(text);
  });

  it('returns the full text unchanged for the "General" filter', () => {
    expect(extractRelevantContent(text, 'General')).toBe(text);
  });

  it('returns the full text unchanged for a filter with no known keywords', () => {
    expect(extractRelevantContent(text, 'NotARealFilter')).toBe(text);
  });

  // BUG (pre-existing, not introduced by this test suite): the block-splitting
  // regex `/(?=\n- |\n\n|\n*)/g` includes `\n*`, which is satisfiable by a
  // zero-length match at every position. That makes `text.split(...)` cut the
  // string into individual characters instead of paragraphs, so no keyword
  // regex (all 2+ characters) can ever match a "block", `matchingBlocks` is
  // always empty, and the function silently falls back to the full text for
  // *every* filter. This test documents that current, real behavior rather
  // than the evidently-intended one (narrowing to matching paragraphs) —
  // see the chat writeup for the suggested fix.
  it('currently returns the full text unchanged for every filter, due to a block-splitting bug', () => {
    expect(extractRelevantContent(text, 'Workload')).toBe(text);
  });
});
