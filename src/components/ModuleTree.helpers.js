import { normalizeModuleCode } from './ModTree_components/modTreeModuleData';

export const SEMESTER_LABELS = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];
export const PLANNER_COLUMN_LABELS = ['Precluded Modules', ...SEMESTER_LABELS];
export const TEMP_MODTREE_STATE_STORAGE_KEY = 'whattomod.modtree.temporaryState';

function getTemporaryStateStorage() {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

export function readTemporaryModTreeState() {
    const storage = getTemporaryStateStorage();
    if (!storage) {
        return null;
    }

    const rawValue = storage.getItem(TEMP_MODTREE_STATE_STORAGE_KEY);
    if (!rawValue) {
        return null;
    }

    try {
        return normalizeSavedModTreeState(JSON.parse(rawValue));
    } catch {
        return null;
    }
}

export function saveTemporaryModTreeState(state) {
    const storage = getTemporaryStateStorage();
    if (!storage) {
        return;
    }

    if (!state) {
        storage.removeItem(TEMP_MODTREE_STATE_STORAGE_KEY);
        return;
    }

    storage.setItem(TEMP_MODTREE_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function clearTemporaryModTreeState() {
    const storage = getTemporaryStateStorage();
    if (!storage) {
        return;
    }

    storage.removeItem(TEMP_MODTREE_STATE_STORAGE_KEY);
}

export function createEmptyPlannerModules(labels = PLANNER_COLUMN_LABELS) {
    return Object.fromEntries(labels.map((label) => [label, []]));
}

export function collectNestedModules(node, db) {
    if (!node || typeof node !== 'object') {
        return;
    }

    if (typeof node.id === 'string' && node.id && !db[node.id]) {
        db[node.id] = node;
    }

    if (Array.isArray(node.children)) {
        node.children.forEach((child) => collectNestedModules(child, db));
    }

    if (Array.isArray(node.options)) {
        node.options.forEach((option) => collectNestedModules(option, db));
    }

    if (Array.isArray(node.RequirementsPillar)) {
        node.RequirementsPillar.forEach((pillar) => {
            if (pillar && typeof pillar === 'object' && Array.isArray(pillar.options)) {
                pillar.options.forEach((option) => collectNestedModules(option, db));
            }
        });
    }
}

export function isCaseGRow(row) {
    return typeof row?.id === 'string'
        && row.id.endsWith('_not_rendered')
        && Array.isArray(row.not_rendered)
        && row.not_rendered.some((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

export function normalizeCaseGRow(row) {
    if (!isCaseGRow(row)) {
        return null;
    }

    return {
        id: row.id,
        label: row.label ?? 'Not Rendered',
        majors: Array.isArray(row.majors) ? row.majors : [],
        notRendered: row.not_rendered.filter((entry) => typeof entry === 'string' && entry.trim().length > 0),
    };
}

export function getModuleDisplayLevel(module, groupDisplayLevels) {
    const groupedLevel = module?.orGroupId ? groupDisplayLevels.get(module.orGroupId) : undefined;
    const rawLevel = Number(groupedLevel ?? module?.level);

    return Number.isFinite(rawLevel) ? rawLevel : module?.level;
}

export function rowToModule(row) {
    return {
        id: row.id,
        label: row.label,
        level: row.level,
        description: row.description,
        majors: row.majors ?? [],
        orGroupId: row.or_group_id ?? undefined,
        isPillar: row.is_pillar,
        isSingleModulePillar: row.is_single_module_pillar,
        pillarLabel: row.pillar_label ?? undefined,
        isLevel4000Pathway: row.is_level4000_pathway,
        options: row.options ?? undefined,
        isRequirementGroup: row.is_requirement_group ?? row.isRequirementGroup ?? false,
        Requirements: row.Requirements ?? row.requirements ?? [],
        RequirementsPillar: row.RequirementsPillar ?? row.requirementspillar ?? [],
    };
}

export function buildDatabase(modules) {
    const db = {};
    modules.forEach((mod) => {
        collectNestedModules(mod, db);
        if (Array.isArray(mod.options)) {
            mod.options.forEach((option) => collectNestedModules(option, db));
        }
    });
    return db;
}

export function normalizeCustomModuleRecord(module) {
    if (!module) {
        return null;
    }

    if (typeof module === 'string') {
        return {
            moduleCode: normalizeModuleCode(module),
            title: module.toUpperCase(),
            hasModTreeMetadata: false,
            source: 'fallback',
        };
    }

    const moduleCode = normalizeModuleCode(module.moduleCode);
    if (!moduleCode) {
        return null;
    }

    return {
        ...module,
        moduleCode,
    };
}

export function normalizePlannerModules(plannerModules) {
    const emptyPlanner = createEmptyPlannerModules();

    if (!plannerModules || typeof plannerModules !== 'object') {
        return emptyPlanner;
    }

    return Object.fromEntries(
        Object.keys(emptyPlanner).map((semester) => {
            const savedModules = Array.isArray(plannerModules[semester]) ? plannerModules[semester] : [];
            return [
                semester,
                savedModules
                    .map(normalizeModuleCode)
                    .filter(Boolean),
            ];
        })
    );
}

export function normalizeSavedAcadsPlannerState(savedState) {
    if (!savedState || typeof savedState !== 'object') {
        return createEmptyPlannerModules();
    }

    return normalizePlannerModules(savedState.plannerModules ?? savedState);
}

// Maps a pillar's row id to `true` for a manual check-off, marking it
// fulfilled independent of whether any of its listed options are selected.
export function normalizeManualPillarOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object') {
        return {};
    }

    return Object.fromEntries(
        Object.entries(overrides).filter(([pillarId, value]) => typeof pillarId === 'string' && pillarId.trim() && value === true)
    );
}

export function buildPersistedModTreeState({
    selectedMajor,
    selectedMods,
    customModules,
    plannerModules,
    manualPillarOverrides,
    previousState = {},
}) {
    return {
        ...previousState,
        selectedMajor: selectedMajor ?? 'Empty-Major',
        selectedMods: Array.isArray(selectedMods)
            ? selectedMods.map(normalizeModuleCode).filter(Boolean)
            : [],
        customModules: Array.isArray(customModules)
            ? customModules.map(normalizeCustomModuleRecord).filter(Boolean)
            : [],
        plannerModules: normalizePlannerModules(plannerModules),
        manualPillarOverrides: normalizeManualPillarOverrides(manualPillarOverrides),
    };
}

export function normalizeSavedModTreeState(savedState) {
    if (!savedState || typeof savedState !== 'object') {
        return null;
    }

    return {
        ...savedState,
        selectedMajor: typeof savedState.selectedMajor === 'string' && savedState.selectedMajor.trim()
            ? savedState.selectedMajor
            : 'Empty-Major',
        selectedMods: Array.isArray(savedState.selectedMods)
            ? savedState.selectedMods.map(normalizeModuleCode).filter(Boolean)
            : [],
        customModules: Array.isArray(savedState.customModules)
            ? savedState.customModules.map(normalizeCustomModuleRecord).filter(Boolean)
            : [],
        plannerModules: normalizePlannerModules(savedState.plannerModules),
        manualPillarOverrides: normalizeManualPillarOverrides(savedState.manualPillarOverrides),
    };
}
