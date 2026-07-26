import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ModuleButton from '../ModTree_ModButton';

const lookupModuleMetadataMock = vi.hoisted(() => vi.fn());
const fetchSentimentMock = vi.hoisted(() => vi.fn());

vi.mock('../modTreeModuleData', () => ({
  lookupModuleMetadata: (...args) => lookupModuleMetadataMock(...args),
}));

vi.mock('../../../utils/api', () => ({
  fetchSentiment: (...args) => fetchSentimentMock(...args),
}));

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
      <ModuleButton
        moduleCode="cs1234"
        isSelected={false}
        moduleTreeState={{}}
        onToggle={vi.fn()}
      />
    );

    expect(await screen.findByRole('button', { name: 'Unknown' })).toBeDisabled();
  });
});
