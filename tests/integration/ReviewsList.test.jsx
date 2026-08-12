import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReviewsList } from '../../src/components/SentAnalysis/ReviewsList';

afterEach(cleanup);

function makeReview(id, text, overrides = {}) {
  return { id, moduleCode: 'CS1010', text, semester: 'Semester 1', scrapedAt: '2026-01-01', ...overrides };
}

describe('ReviewsList', () => {
  it('renders the review count and every review when under one page', () => {
    const reviews = [
      makeReview('1', 'A solid module overall.'),
      makeReview('2', 'The workload was heavy, expect 10 hours a week.'),
    ];
    render(<ReviewsList reviews={reviews} />);

    expect(screen.getByText('2', { selector: '.reviews-count' })).toBeInTheDocument();
    expect(document.querySelectorAll('.review-card')).toHaveLength(2);
    expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
  });

  it('filters reviews down to those matching the selected topic', () => {
    const reviews = [
      makeReview('1', 'The workload was heavy, expect 10 hours a week.'),
      makeReview('2', 'The lecturer was engaging and clear.'),
    ];
    render(<ReviewsList reviews={reviews} />);

    fireEvent.click(screen.getByRole('button', { name: 'Workload' }));

    expect(document.querySelectorAll('.review-card')).toHaveLength(1);
    expect(screen.getByText(/workload was heavy/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(document.querySelectorAll('.review-card')).toHaveLength(2);
  });

  it('shows an empty-filter message when no review matches the selected topic', () => {
    const reviews = [makeReview('1', 'A perfectly ordinary review with no keywords.')];
    render(<ReviewsList reviews={reviews} />);

    fireEvent.click(screen.getByRole('button', { name: 'Grade' }));

    expect(screen.getByText('No reviews match this filter.')).toBeInTheDocument();
    expect(document.querySelectorAll('.review-card')).toHaveLength(0);
  });

  it('paginates in pages of 10, and "Load more" reveals the rest', () => {
    const reviews = Array.from({ length: 15 }, (_, i) => makeReview(String(i), `Review number ${i}`));
    render(<ReviewsList reviews={reviews} />);

    expect(document.querySelectorAll('.review-card')).toHaveLength(10);
    expect(screen.getByText('Load more (5 remaining)')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Load more (5 remaining)'));

    expect(document.querySelectorAll('.review-card')).toHaveLength(15);
    expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
  });

  it('resets back to page 1 when the filter changes', () => {
    const reviews = Array.from({ length: 15 }, (_, i) => makeReview(String(i), `Review number ${i}, mentions workload`));
    render(<ReviewsList reviews={reviews} />);

    fireEvent.click(screen.getByText('Load more (5 remaining)'));
    expect(document.querySelectorAll('.review-card')).toHaveLength(15);

    fireEvent.click(screen.getByRole('button', { name: 'Workload' }));
    expect(document.querySelectorAll('.review-card')).toHaveLength(10);
  });

  it('expands and collapses review text longer than 280 characters', () => {
    const longText = 'This module was great. '.repeat(20); // > 280 chars
    render(<ReviewsList reviews={[makeReview('1', longText)]} />);

    expect(screen.getByText('Show more')).toBeInTheDocument();
    expect(screen.getByText(/…$/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show more'));
    expect(screen.getByText('Show less')).toBeInTheDocument();
    expect(screen.queryByText(/…$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show less'));
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });
});
