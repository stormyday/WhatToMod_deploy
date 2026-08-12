import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ModTreeProgressBar from '../ModTree_ProgressBar';

describe('ModTreeProgressBar', () => {
  it('renders a clamped completion percentage and summary text', () => {
    const { container } = render(<ModTreeProgressBar completed={12} total={8} />);

    expect(screen.getByText('ModTree completion')).toBeInTheDocument();
    expect(screen.getByText('12 / 8 modules')).toBeInTheDocument();

    const fillBar = container.querySelector('[style*="linear-gradient"]');
    expect(fillBar).toHaveStyle({ width: '100%' });
  });

  it('falls back to zero progress when the inputs are invalid', () => {
    const { container } = render(<ModTreeProgressBar completed={Number.NaN} total={-5} />);

    expect(screen.getByText('0 / 0 modules')).toBeInTheDocument();

    const fillBar = container.querySelector('[style*="linear-gradient"]');
    expect(fillBar).toHaveStyle({ width: '0%' });
  });
});
