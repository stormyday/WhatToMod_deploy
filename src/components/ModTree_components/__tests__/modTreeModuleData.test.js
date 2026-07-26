import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseFromMock = vi.hoisted(() => vi.fn());
const fetchModuleDetailMock = vi.hoisted(() => vi.fn());
const fetchModuleListMock = vi.hoisted(() => vi.fn());

function createQuery(result) {
  return {
    then(onFulfilled, onRejected) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve(result);
    },
  };
}

vi.mock('../../../supabaseClient', () => ({
  supabase: {
    from: (...args) => supabaseFromMock(...args),
  },
}));

vi.mock('../../../utils/api', () => ({
  fetchModuleDetail: (...args) => fetchModuleDetailMock(...args),
  fetchModuleList: (...args) => fetchModuleListMock(...args),
}));

describe('modTreeModuleData', () => {
  beforeEach(() => {
    vi.resetModules();
    supabaseFromMock.mockReset();
    fetchModuleDetailMock.mockReset();
    fetchModuleListMock.mockReset();
  });

  it('normalizes codes, prerequisite conflicts, and recursive search catalog entries', async () => {
    supabaseFromMock.mockImplementation((table) => {
      if (table === 'modules') {
        return {
          select() {
            return createQuery({
              data: [
                {
                  id: 'CS2100',
                  label: 'Computer Organisation',
                  description: 'Has nested modules',
                  options: [
                    { id: 'CS1231S', label: 'Discrete Structures' },
                  ],
                  RequirementsPillar: [
                    {
                      options: [
                        { id: 'CS2040S', label: 'Data Structures' },
                      ],
                    },
                  ],
                },
                {
                  id: 'CS9999',
                  label: 'Structural Row',
                  not_rendered: ['Hidden note'],
                },
              ],
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    fetchModuleListMock.mockResolvedValue([
      { moduleCode: 'CS2100', title: 'Computer Organisation' },
      { moduleCode: 'CS8888', title: 'Fallback Module' },
    ]);

    const mod = await import('../modTreeModuleData.jsx');

    expect(mod.normalizeModuleCode(' CS2100 ')).toBe('cs2100');
    expect(mod.normalizeModuleCode(null)).toBe('');
    expect(mod.getPrereqConflictMessages({ prereqCodes: ['cs1231s', 'cs2100'] }, ['CS2100'])).toEqual(['CS1231S']);

    const catalog = await mod.getModTreeSearchCatalog();
    expect(catalog.map((entry) => entry.moduleCode)).toEqual(['cs1231s', 'cs2040s', 'cs2100', 'cs8888', 'cs9999']);
    expect(catalog.find((entry) => entry.moduleCode === 'cs2100')).toMatchObject({
      hasModTreeMetadata: true,
      searchHidden: true,
      source: 'modtree',
    });
    expect(catalog.find((entry) => entry.moduleCode === 'cs9999')).toMatchObject({
      searchHidden: true,
      source: 'modtree',
    });
    expect(catalog.find((entry) => entry.moduleCode === 'cs8888')).toMatchObject({
      hasModTreeMetadata: false,
      source: 'fallback',
    });
  });

  it('falls back to NUSMods details when the database lookup misses', async () => {
    supabaseFromMock.mockImplementation((table) => {
      if (table === 'modules') {
        return {
          select() {
            return createQuery({
              data: null,
              error: null,
            });
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    });
    fetchModuleListMock.mockResolvedValue([]);
    fetchModuleDetailMock.mockResolvedValue({
      moduleCode: 'CS9999',
      title: 'Fallback Title',
      description: 'Fallback description',
    });

    const mod = await import('../modTreeModuleData.jsx');
    const result = await mod.lookupModuleMetadata('cs9999');

    expect(result).toMatchObject({
      id: 'cs9999',
      moduleCode: 'cs9999',
      title: 'Fallback Title',
      description: 'Fallback description',
      hasModTreeMetadata: false,
      source: 'fallback',
    });
    expect(fetchModuleDetailMock).toHaveBeenCalledWith('cs9999');
  });
});
