import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ModuleButton from '../ModTree_ModButton';
import { GradeReccoContext } from '../../modRecco/gradeReccoState';

const lookupModuleMetadataMock = vi.hoisted(() => vi.fn());
const fetchSentimentMock = vi.hoisted(() => vi.fn());

vi.mock('../modTreeModuleData', () => ({
  lookupModuleMetadata: (...args) => lookupModuleMetadataMock(...args),
}));

vi.mock('../../../utils/api', () => ({
  fetchSentiment: (...args) => fetchSentimentMock(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    Link: ({ children }) => <a href="#details">{children}</a>,
  };
});

describe('ModuleButton', () => {
  beforeEach(() => {
    lookupModuleMetadataMock.mockReset();
    fetchSentimentMock.mockReset();
    lookupModuleMetadataMock.mockResolvedValue({
      id: 'cs1234',
      label: 'Intro to Testing',
      description: 'Testing module',
      moduleCode: 'cs1234',
      title: 'Intro to Testing',
      hasModTreeMetadata: true,
      source: 'modtree',
    });
  });

  it('renders the resolved module code and calls onToggle on click', async () => {
    const onToggle = vi.fn();

    render(
      <ModuleButton
        moduleCode="cs1234"
        isSelected={false}
        moduleTreeState={{}}
        onToggle={onToggle}
      />
    );

    const button = await screen.findByRole('button', { name: 'CS1234' });
    fireEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(lookupModuleMetadataMock).toHaveBeenCalledWith('cs1234');
  });

  it('renders the unknown fallback when metadata lookup fails', async () => {
    lookupModuleMetadataMock.mockResolvedValueOnce(null);

    render(
      <MemoryRouter>
        <ModuleButton
          moduleCode="cs1234"
          isSelected={false}
          moduleTreeState={{}}
          onToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: 'Unknown' })).toBeDisabled();
  });

  it('shows compact workload and difficulty bars with the grade-rule prediction in its tooltip', async () => {
    fetchSentimentMock.mockResolvedValue({
      workload: { label: 'Workload', level: 'Medium', score: 0.5, descriptor: '' },
      difficulty: { label: 'Difficulty', level: 'High', score: 0.75, descriptor: '' },
      reviewCount: 12,
    });

    const { container } = render(
      <MemoryRouter>
        <GradeReccoContext.Provider value={new Map([['CS1234', {
          predictedGrade: 'A-',
          referenceModuleCount: 2,
        }]])}>
          <ModuleButton
            moduleCode="cs1234"
            isSelected={false}
            moduleTreeState={{}}
            onToggle={vi.fn()}
          />
        </GradeReccoContext.Provider>
      </MemoryRouter>
    );

    fireEvent.mouseEnter(await within(container).findByRole('button', { name: 'CS1234' }));

    expect(await screen.findByText('Expected Grade')).toBeInTheDocument();
    expect(screen.getByText('A- (2-module reference)')).toBeInTheDocument();

    const sentimentGrid = screen.getByText('Workload').parentElement?.parentElement?.parentElement;
    expect(sentimentGrid).toHaveStyle({ display: 'grid', gridTemplateColumns: '1fr 1fr' });
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
