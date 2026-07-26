import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

const selectionBasketButtonMock = vi.hoisted(() => vi.fn((props) => (
  <button
    type="button"
    data-testid="basket-card"
    onClick={props.onToggle}
  >
    {props.moduleCode}
  </button>
)));

vi.mock('../ModTree_SelectionBasketButton', () => ({
  default: (props) => selectionBasketButtonMock(props),
}));

import SelectedBasket from '../ModTree_SelectionBasket';

describe('SelectedBasket', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    selectionBasketButtonMock.mockClear();
  });

  it('shows the empty state and disables clear-all when nothing is selected', () => {
    const onClearAll = vi.fn();

    render(
      <SelectedBasket
        selectedMods={[]}
        moduleTreeState={{}}
        onToggleModule={vi.fn()}
        onClearAll={onClearAll}
      />
    );

    expect(screen.getByText('Selected Modules')).toBeInTheDocument();
    expect(screen.getByText('No modules selected yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeDisabled();
    expect(selectionBasketButtonMock).not.toHaveBeenCalled();
  });

  it('renders selected modules and forwards toggle actions', () => {
    const onToggleModule = vi.fn();
    const onClearAll = vi.fn();

    render(
      <SelectedBasket
        selectedMods={['CS2100', 'CS1231S']}
        moduleTreeState={{}}
        onToggleModule={onToggleModule}
        onClearAll={onClearAll}
      />
    );

    expect(screen.getByText('Total MCs in Basket: 8')).toBeInTheDocument();
    expect(screen.getAllByTestId('basket-card')).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear All' })[0]);
    expect(onClearAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('CS2100'));
    expect(onToggleModule).toHaveBeenCalledWith('CS2100');
  });
});
