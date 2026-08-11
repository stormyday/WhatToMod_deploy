import { fireEvent, render, screen, within } from '@testing-library/react';
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

    expect(onToggleModule).toHaveBeenCalledWith('CS1231S', 'pillar-1');
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

  it('shows a pillar-originated selection only in its source dropdown', () => {
    const sharedOptions = [{ id: 'CS1101S', label: 'Foundations' }];

    render(
      <>
        <PillarDropdown
          pillarModule={{ id: 'pillar-1', label: 'Pillar One', options: sharedOptions }}
          selectedMods={['CS1101S']}
          pillarSelections={{ CS1101S: 'pillar-1' }}
          moduleTreeState={{}}
          onToggleModule={vi.fn()}
        />
        <PillarDropdown
          pillarModule={{ id: 'pillar-2', label: 'Pillar Two', options: sharedOptions }}
          selectedMods={['CS1101S']}
          pillarSelections={{ CS1101S: 'pillar-1' }}
          moduleTreeState={{}}
          onToggleModule={vi.fn()}
        />
      </>
    );

    expect(screen.getByRole('button', { name: /Foundations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pillar Two/i })).toBeInTheDocument();
  });

  it('shows a standalone selection in every matching dropdown', () => {
    const sharedOptions = [{ id: 'CS1101S', label: 'Foundations' }];

    const { container } = render(
      <>
        <PillarDropdown
          pillarModule={{ id: 'pillar-1', label: 'Pillar One', options: sharedOptions }}
          selectedMods={['CS1101S']}
          moduleTreeState={{}}
          onToggleModule={vi.fn()}
        />
        <PillarDropdown
          pillarModule={{ id: 'pillar-2', label: 'Pillar Two', options: sharedOptions }}
          selectedMods={['CS1101S']}
          moduleTreeState={{}}
          onToggleModule={vi.fn()}
        />
      </>
    );

    expect(within(container).getAllByRole('button', { name: /Foundations/i })).toHaveLength(2);
  });
});
