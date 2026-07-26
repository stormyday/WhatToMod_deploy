import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

const selectionBasketButtonMock = vi.hoisted(() => vi.fn((props) => (
  <button
    type="button"
    data-testid="planner-card"
    data-module-code={props.moduleCode}
    data-available={props.availableModuleCodes?.join(',') ?? ''}
    data-full-width={String(props.fullWidth)}
    onClick={props.onRemove}
  >
    {props.moduleCode}
  </button>
)));

vi.mock('../../ModTree_components/ModTree_SelectionBasketButton', () => ({
  default: (props) => selectionBasketButtonMock(props),
}));

import AcadsPlanner from '../ModTree_AcadsPlanner';

describe('AcadsPlanner', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    selectionBasketButtonMock.mockClear();
  });

  it('passes prior semester module codes to later semester cards and handles drops', () => {
    const onDropModuleToSemester = vi.fn();
    const onClearSemesterModules = vi.fn();
    const onRemoveModuleFromPlanner = vi.fn();

    const { container } = render(
      <AcadsPlanner
      plannerModules={{
          'Precluded Modules': [],
          Y1S1: ['CS2100', 'CS1231S'],
          Y1S2: ['CS2040S'],
          Y2S1: [],
          Y2S2: [],
          Y3S1: [],
          Y3S2: [],
          Y4S1: [],
          Y4S2: [],
        }}
        selectedMods={['CS2100', 'CS1231S', 'CS2040S']}
        moduleTreeState={{}}
        onDropModuleToSemester={onDropModuleToSemester}
        onClearSemesterModules={onClearSemesterModules}
        onRemoveModuleFromPlanner={onRemoveModuleFromPlanner}
        onToggleModule={vi.fn()}
        semesterLabels={['Precluded Modules', 'Y1S1', 'Y1S2']}
      />
    );

    expect(screen.getByText('Module Planner')).toBeInTheDocument();
    expect(selectionBasketButtonMock).toHaveBeenNthCalledWith(1,
      expect.objectContaining({
        moduleCode: 'CS2100',
        availableModuleCodes: [],
        fullWidth: true,
      })
    );
    expect(selectionBasketButtonMock).toHaveBeenNthCalledWith(3,
      expect.objectContaining({
        moduleCode: 'CS2040S',
        availableModuleCodes: ['CS2100', 'CS1231S'],
        fullWidth: true,
      })
    );

    const semesterColumn = screen.getByText('Y1S2');
    const dataTransfer = {
      getData: vi.fn(() => 'CS9999'),
      dropEffect: '',
    };
    fireEvent.drop(semesterColumn, { dataTransfer });

    expect(onDropModuleToSemester).toHaveBeenCalledWith('Y1S2', 'CS9999');

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]);
    expect(onClearSemesterModules).toHaveBeenCalledWith('Precluded Modules');

    const plannerCards = container.querySelectorAll('[data-testid="planner-card"]');
    expect(plannerCards).toHaveLength(3);
    expect(onRemoveModuleFromPlanner).not.toHaveBeenCalled();
  });
});
