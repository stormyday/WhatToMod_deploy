import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildDatabase,
  buildPersistedModTreeState,
  clearTemporaryModTreeState,
  normalizeSavedModTreeState,
  normalizeSavedAcadsPlannerState,
  normalizePlannerModules,
  readTemporaryModTreeState,
  saveTemporaryModTreeState,
  rowToModule,
  TEMP_MODTREE_STATE_STORAGE_KEY,
} from '../ModuleTree.helpers';

describe('ModuleTree helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('normalizes persisted state and planner payloads', () => {
    const persisted = buildPersistedModTreeState({
      selectedMajor: '',
      selectedMods: [' cs2100 ', null, 'CS1231S'],
      pillarSelections: { CS2100: 'pillar-1', CS2040S: 'pillar-2' },
      customModules: [
        'cs9999',
        { moduleCode: ' cs2040s ', title: 'Data Structures' },
        { moduleCode: '', title: 'Ignored' },
      ],
      plannerModules: {
        Y1S1: ['cs2100', ''],
        Y1S2: ['CS1231S'],
        Unknown: ['CS2040S'],
      },
      previousState: { scrollPosition: 123, preserved: true },
    });

    expect(persisted).toMatchObject({
      scrollPosition: 123,
      preserved: true,
      selectedMajor: '',
      selectedMods: ['cs2100', 'cs1231s'],
      pillarSelections: { cs2100: 'pillar-1' },
      customModules: [
        { moduleCode: 'cs9999', title: 'CS9999', hasModTreeMetadata: false, source: 'fallback' },
        { moduleCode: 'cs2040s', title: 'Data Structures' },
      ],
      plannerModules: {
        Y1S1: ['cs2100'],
        Y1S2: ['cs1231s'],
        Y2S1: [],
        Y2S2: [],
        Y3S1: [],
        Y3S2: [],
        Y4S1: [],
        Y4S2: [],
      },
    });

    expect(normalizeSavedModTreeState({
      selectedMajor: '  CS  ',
      selectedMods: [' cs2040s '],
      pillarSelections: { CS2040S: 'pillar-1', CS2100: 'pillar-2' },
      customModules: ['cs2100'],
      plannerModules: { Y1S1: ['cs2100'] },
    })).toMatchObject({
      selectedMajor: '  CS  ',
      selectedMods: ['cs2040s'],
      pillarSelections: { cs2040s: 'pillar-1' },
      customModules: [
        { moduleCode: 'cs2100', title: 'CS2100', hasModTreeMetadata: false, source: 'fallback' },
      ],
      plannerModules: {
        Y1S1: ['cs2100'],
      },
    });

    expect(normalizePlannerModules({ Y1S1: [' CS1231S '], Y4S2: ['CS2100'] })).toMatchObject({
      Y1S1: ['cs1231s'],
      Y4S2: ['cs2100'],
    });
    expect(normalizeSavedAcadsPlannerState({ plannerModules: { Y1S1: ['CS1231S'] } })).toMatchObject({
      Y1S1: ['cs1231s'],
    });
  });

  it('round-trips temporary ModTree state through session storage', () => {
    saveTemporaryModTreeState({
      selectedMajor: '  CS  ',
      selectedMods: [' CS2100 '],
      pillarSelections: { CS2100: 'pillar-1' },
      customModules: ['cs9999'],
      plannerModules: { Y1S1: ['CS1231S'] },
      scrollPosition: 320,
    });

    expect(window.sessionStorage.getItem(TEMP_MODTREE_STATE_STORAGE_KEY)).toContain('CS2100');
    expect(readTemporaryModTreeState()).toMatchObject({
      selectedMajor: '  CS  ',
      selectedMods: ['cs2100'],
      pillarSelections: { cs2100: 'pillar-1' },
      customModules: [
        { moduleCode: 'cs9999', title: 'CS9999', hasModTreeMetadata: false, source: 'fallback' },
      ],
      plannerModules: {
        Y1S1: ['cs1231s'],
      },
      scrollPosition: 320,
    });

    clearTemporaryModTreeState();
    expect(window.sessionStorage.getItem(TEMP_MODTREE_STATE_STORAGE_KEY)).toBeNull();
    expect(readTemporaryModTreeState()).toBeNull();
  });

  it('builds the module database and row shapes from nested rows', () => {
    const row = {
      id: 'CS9999',
      label: 'Root',
      level: 1000,
      description: 'Root row',
      majors: ['CS'],
      or_group_id: 'grp-1',
      is_pillar: true,
      is_single_module_pillar: false,
      pillar_label: 'Core',
      is_level4000_pathway: false,
      options: [{ id: 'CS1231S' }],
      is_requirement_group: true,
      Requirements: ['Need this'],
      RequirementsPillar: [{ options: [{ id: 'CS2040S' }] }],
    };

    expect(rowToModule(row)).toMatchObject({
      id: 'CS9999',
      orGroupId: 'grp-1',
      isPillar: true,
      isRequirementGroup: true,
      Requirements: ['Need this'],
      RequirementsPillar: [{ options: [{ id: 'CS2040S' }] }],
    });

    const db = buildDatabase([{
      id: 'CS9999',
      children: [{ id: 'CS1231S' }],
      options: [{ id: 'CS2040S' }],
      RequirementsPillar: [{ options: [{ id: 'CS2100' }] }],
    }]);

    expect(Object.keys(db).sort()).toEqual(['CS1231S', 'CS2040S', 'CS2100', 'CS9999']);
  });

});
