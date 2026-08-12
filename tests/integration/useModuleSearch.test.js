import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModuleSearch } from '../../src/hooks/useModuleSearch';
import * as api from '../../src/utils/api';

vi.mock('../../src/utils/api', () => ({
  fetchModuleList: vi.fn(),
  fetchModule: vi.fn(),
}));

const MODULE_LIST = [
  { moduleCode: 'CS1010', title: 'Programming Methodology', semesters: [1, 2] },
  { moduleCode: 'CS1231', title: 'Discrete Structures', semesters: [1, 2] },
  { moduleCode: 'MA1521', title: 'Calculus for Computing', semesters: [1, 2] },
];

describe('useModuleSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchModuleList.mockResolvedValue(MODULE_LIST);
  });

  it('loads the module list on mount', async () => {
    const { result } = renderHook(() => useModuleSearch());
    await waitFor(() => expect(api.fetchModuleList).toHaveBeenCalledTimes(1));
    expect(result.current.suggestions).toEqual([]);
  });

  it('filters suggestions by module code or title once the query is 2+ chars', async () => {
    const { result } = renderHook(() => useModuleSearch());
    await waitFor(() => expect(api.fetchModuleList).toHaveBeenCalled());

    act(() => result.current.setQuery('c'));
    await waitFor(() => expect(result.current.suggestions).toEqual([]));

    act(() => result.current.setQuery('cs1'));
    await waitFor(() => {
      expect(result.current.suggestions.map((m) => m.moduleCode)).toEqual(['CS1010', 'CS1231']);
    });

    act(() => result.current.setQuery('calculus'));
    await waitFor(() => {
      expect(result.current.suggestions.map((m) => m.moduleCode)).toEqual(['MA1521']);
    });
  });

  it('loadModule sets the result on success and clears loading/error state', async () => {
    const moduleResponse = { module: { moduleCode: 'CS1010' } };
    api.fetchModule.mockResolvedValue(moduleResponse);

    const { result } = renderHook(() => useModuleSearch());
    await waitFor(() => expect(api.fetchModuleList).toHaveBeenCalled());

    await act(async () => {
      await result.current.loadModule('CS1010');
    });

    expect(api.fetchModule).toHaveBeenCalledWith('CS1010');
    expect(result.current.result).toEqual(moduleResponse);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.query).toBe('CS1010');
  });

  it('loadModule surfaces an error message and leaves result empty on failure', async () => {
    api.fetchModule.mockRejectedValue(new Error('Module NOT_REAL not found'));

    const { result } = renderHook(() => useModuleSearch());
    await waitFor(() => expect(api.fetchModuleList).toHaveBeenCalled());

    await act(async () => {
      await result.current.loadModule('NOT_REAL');
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe('Module NOT_REAL not found');
    expect(result.current.loading).toBe(false);
  });
});
