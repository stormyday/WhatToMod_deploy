import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import PillarDropdown from '../ModTree_PillarMod';

const moduleButtonMock = vi.hoisted(() => vi.fn(({ moduleCode, onToggle }) => (
  <button type="button" onClick={onToggle}>
    {moduleCode}
  </button>
)));

vi.mock('../ModTree_ModButton', () => ({
  default: (props) => moduleButtonMock(props),
}));

describe('PillarDropdown', () => {
  beforeEach(() => {
    moduleButtonMock.mockClear();
  });

  it('opens the option list and closes after selecting an option', async () => {
    const onToggleModule = vi.fn();

    render(
      <PillarDropdown
        pillarModule={{
          id: 'pillar-1',
          label: 'Pillar One',
          options: [
            { id: 'CS1101S', label: 'CS1101S' },
            { id: 'CS1231S', label: 'CS1231S' },
            { id: 'CS2040S', label: 'CS2040S' },
            { id: 'CS2100', label: 'CS2100' },
            { id: 'CS2103T', label: 'CS2103T' },
            { id: 'CS2106', label: 'CS2106' },
            { id: 'CS3230', label: 'CS3230' },
            { id: 'CS3243', label: 'CS3243' },
          ],
        }}
        selectedMods={[]}
        moduleTreeState={{}}
        onToggleModule={onToggleModule}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Pillar One/i }));

    expect(screen.getByText('Select 1 Option:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CS1101S' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CS3243' })).toBeInTheDocument();
    expect(moduleButtonMock).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'CS1231S' }));

    expect(onToggleModule).toHaveBeenCalledWith('CS1231S');
    expect(screen.queryByText('Select 1 Option:')).not.toBeInTheDocument();
  });

  it('shows the selected module label in the trigger', () => {
    render(
      <PillarDropdown
        pillarModule={{
          id: 'pillar-1',
          label: 'Pillar One',
          options: [
            { id: 'CS1101S', label: 'Foundations' },
            { id: 'CS1231S', label: 'Discrete' },
          ],
        }}
        selectedMods={['CS1231S']}
        moduleTreeState={{}}
        onToggleModule={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Discrete/i })).toBeInTheDocument();
  });
});
