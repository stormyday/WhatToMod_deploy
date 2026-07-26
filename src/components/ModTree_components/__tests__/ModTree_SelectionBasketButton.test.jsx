import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SelectionBasketButton from '../ModTree_SelectionBasketButton';

const lookupModuleMetadataMock = vi.hoisted(() => vi.fn());
const lookupModulePrereqMock = vi.hoisted(() => vi.fn());
const fetchSentimentMock = vi.hoisted(() => vi.fn());

vi.mock('../modTreeModuleData', () => ({
  lookupModuleMetadata: (...args) => lookupModuleMetadataMock(...args),
  lookupModulePrereq: (...args) => lookupModulePrereqMock(...args),
  normalizeModuleCode: (value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''),
  getPrereqConflictMessages: (prereqRow, availableModuleCodes = []) => {
    const available = new Set(availableModuleCodes.map((code) => code.toLowerCase()));
    return (prereqRow?.prereqCodes ?? [])
      .map((code) => code.toUpperCase())
      .filter((code) => !available.has(code.toLowerCase()));
  },
}));

vi.mock('../../../utils/api', () => ({
  fetchSentiment: (...args) => fetchSentimentMock(...args),
}));

describe('SelectionBasketButton', () => {
  beforeEach(() => {
    lookupModuleMetadataMock.mockReset();
    lookupModulePrereqMock.mockReset();
    fetchSentimentMock.mockReset();

    lookupModuleMetadataMock.mockResolvedValue({
      id: 'cs1234',
      moduleCode: 'cs1234',
      title: 'Testing in Practice',
      description: 'Module description',
      hasModTreeMetadata: true,
      source: 'modtree',
    });
    lookupModulePrereqMock.mockResolvedValue({
      moduleCode: 'cs1234',
      prereqCodes: ['cs1231s'],
      prereqTree: null,
    });
    fetchSentimentMock.mockResolvedValue({
      workload: { label: 'Workload', level: 'Medium', score: 0.5, descriptor: '' },
      difficulty: { label: 'Difficulty', level: 'Medium', score: 0.5, descriptor: '' },
      expectedGrade: { label: 'Expected grade', level: 'A-', score: 0.8, descriptor: '' },
      reviewCount: 12,
    });
  });

  it('renders the module card, remove action, and prerequisite warning', async () => {
    const onRemove = vi.fn();

    render(
      <MemoryRouter>
        <SelectionBasketButton
          moduleCode="cs1234"
          isSelected
          onRemove={onRemove}
          availableModuleCodes={[]}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText('CS1234')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Missing prerequisite from earlier semesters:')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'X' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Notes...')).toBeInTheDocument();
  });

  it('shows fallback module text when metadata lookup fails', async () => {
    lookupModuleMetadataMock.mockResolvedValueOnce(null);

    render(
      <MemoryRouter>
        <SelectionBasketButton
          moduleCode="cs9999"
          isSelected={false}
          onToggle={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(await screen.findByText('Unknown module')).toBeInTheDocument();
  });
});
