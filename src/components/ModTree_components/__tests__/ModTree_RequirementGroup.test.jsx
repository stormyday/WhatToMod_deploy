import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import RequirementGroup from '../ModTree_RequirementGroup';

const pillarDropdownMock = vi.hoisted(() => vi.fn(({ pillarModule, selectedMajor }) => (
  <div data-testid="pillar-dropdown" data-selected-major={selectedMajor}>
    {pillarModule.label}
  </div>
)));

vi.mock('../ModTree_PillarMod', () => ({
  default: (props) => pillarDropdownMock(props),
}));

describe('RequirementGroup', () => {
  beforeEach(() => {
    pillarDropdownMock.mockClear();
  });

  it('renders normalized requirements and nested pillars', () => {
    render(
      <RequirementGroup
        selectedMajor="CS"
        selectedMods={['CS2100']}
        moduleTreeState={{}}
        onToggleModule={vi.fn()}
        nodeData={{
          id: 'group-1',
          label: 'Major Requirements',
          Requirements: '["Alpha", "Beta"]',
          RequirementsPillar: [
            {
              id: 'pillar-a',
              label: 'Pillar A',
              options: [],
            },
          ],
        }}
      />
    );

    expect(screen.getByText('Major Requirements')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByTestId('pillar-dropdown')).toHaveTextContent('Pillar A');
    expect(screen.getByTestId('pillar-dropdown')).toHaveAttribute('data-selected-major', 'CS');
  });

  it('keeps the base card but omits nested pillar selectors when there are no pillars', () => {
    const { container } = render(
      <RequirementGroup
        selectedMajor="CS"
        selectedMods={[]}
        moduleTreeState={{}}
        onToggleModule={vi.fn()}
        nodeData={{
          id: 'group-2',
          label: 'Empty Group',
          Requirements: [],
          RequirementsPillar: [],
        }}
      />
    );

    expect(screen.getByText('Empty Group')).toBeInTheDocument();
    expect(container).toHaveTextContent('Requirements:');
    expect(container.querySelector('[data-testid="pillar-dropdown"]')).toBeNull();
  });
});
