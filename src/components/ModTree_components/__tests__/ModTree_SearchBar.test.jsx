import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModTreeSearchBar } from '../ModTree_SearchBar';

describe('ModTreeSearchBar', () => {
  it('calls onChange, onDismiss, and onSelect from the expected controls', () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    const onDismiss = vi.fn();

    render(
      <ModTreeSearchBar
        query="CS"
        onChange={onChange}
        suggestions={[
          {
            moduleCode: 'cs1231s',
            title: 'Discrete Structures',
            hasModTreeMetadata: true,
          },
        ]}
        onSelect={onSelect}
        onDismiss={onDismiss}
        loading={false}
      />
    );

    const input = screen.getByPlaceholderText('Search any module to add it to ModTree...');
    fireEvent.change(input, { target: { value: 'CS2' } });
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    fireEvent.click(screen.getByText('Discrete Structures'));

    expect(onChange).toHaveBeenCalledWith('CS2');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      moduleCode: 'cs1231s',
      title: 'Discrete Structures',
      hasModTreeMetadata: true,
    });
  });
});
