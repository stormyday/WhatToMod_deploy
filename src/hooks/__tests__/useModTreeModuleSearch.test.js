import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getModTreeSearchCatalogMock = vi.hoisted(() => vi.fn());

vi.mock('../../components/ModTree_components/modTreeModuleData', () => ({
  getModTreeSearchCatalog: (...args) => getModTreeSearchCatalogMock(...args),
}));

import { useModTreeModuleSearch } from '../useModTreeModuleSearch';

describe('useModTreeModuleSearch', () => {
  beforeEach(() => {
    getModTreeSearchCatalogMock.mockReset();
  });

  it('loads the catalog, filters hidden entries, and prioritizes ModTree modules', async () => {
    getModTreeSearchCatalogMock.mockResolvedValue([
      {
        moduleCode: 'cs9999',
        title: 'Fallback Alpha',
        hasModTreeMetadata: false,
        searchHidden: false,
      },
      {
        moduleCode: 'cs2100',
        title: 'Systems Programming',
        hasModTreeMetadata: true,
        searchHidden: false,
      },
      {
        moduleCode: 'cs0000',
        title: 'Hidden Entry',
        hasModTreeMetadata: true,
        searchHidden: true,
      },
    ]);

    const { result } = renderHook(() => useModTreeModuleSearch());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setQuery('cs');
    });

    expect(result.current.suggestions.map((entry) => entry.moduleCode)).toEqual(['cs2100', 'cs9999']);

    act(() => {
      result.current.setQuery('sys');
    });

    expect(result.current.suggestions.map((entry) => entry.moduleCode)).toEqual(['cs2100']);
    expect(result.current.error).toBeNull();
  });
});
