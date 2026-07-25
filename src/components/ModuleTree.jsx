import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';
import { normalizeModuleCode } from './ModTree_components/modTreeModuleData';
import SelectMajor from './ModTree_components/ModTree_SelectMajor';
import ModuleTree from './ModTree_components/ModTree_ModTree';
import CaseGRequirements from './ModTree_components/ModTree_OtherReq';
import SelectedBasket from './ModTree_components/ModTree_SelectionBasket';
import AcadsPlanner from './ModTree_components/ModTree_AcadsPlanner';
import { ModTreeSearchBar } from './ModTree_components/ModTree_SearchBar';
import { useModTreeModuleSearch } from '../hooks/useModTreeModuleSearch';

const SEMESTER_LABELS = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];
const PLANNER_COLUMN_LABELS = ['Precluded Modules', ...SEMESTER_LABELS];

function createEmptyPlannerModules(labels = PLANNER_COLUMN_LABELS) {
    return Object.fromEntries(labels.map(label => [label, []]));
}

function collectNestedModules(node, db) {
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

function isCaseGRow(row) {
    return typeof row?.id === 'string'
        && row.id.endsWith('_not_rendered')
        && Array.isArray(row.not_rendered)
        && row.not_rendered.some((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function normalizeCaseGRow(row) {
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

function getModuleDisplayLevel(module, groupDisplayLevels) {
    const groupedLevel = module?.orGroupId ? groupDisplayLevels.get(module.orGroupId) : undefined;
    const rawLevel = Number(groupedLevel ?? module?.level);

    return Number.isFinite(rawLevel) ? rawLevel : module?.level;
}

// Converts a raw Supabase module row back into the shape the rest of the app expects
function rowToModule(row) {
    return {
        id: row.id,
        label: row.label,
        level: row.level,
        description: row.description,
        majors: row.majors ?? [],
        compulsoryFor: row.compulsory_for ?? [],
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
 
// Build the flat moduleDatabase dictionary from the list of modules
function buildDatabase(modules) {
    const db = {};
    modules.forEach(mod => {
        collectNestedModules(mod, db);
        if (Array.isArray(mod.options)) {
            mod.options.forEach((option) => collectNestedModules(option, db));
        }
    });
    return db;
}

function normalizeCustomModuleRecord(module) {
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

function normalizePlannerModules(plannerModules) {
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

function buildPersistedModTreeState({
    selectedMajor,
    selectedMods,
    customModules,
    plannerModules,
}) {
    return {
        selectedMajor: selectedMajor ?? 'Empty-Major',
        selectedMods: Array.isArray(selectedMods)
            ? selectedMods.map(normalizeModuleCode).filter(Boolean)
            : [],
        customModules: Array.isArray(customModules)
            ? customModules.map(normalizeCustomModuleRecord).filter(Boolean)
            : [],
        plannerModules: normalizePlannerModules(plannerModules),
    };
}

function normalizeSavedModTreeState(savedState) {
    if (!savedState || typeof savedState !== 'object') {
        return null;
    }

    return {
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
    };
}
 
export default function ModuleTreePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { session } = UserAuth();
    const {
        query,
        setQuery,
        suggestions,
        setSuggestions,
        loading: searchLoading,
        error: searchError,
    } = useModTreeModuleSearch();
 
    const [selectedMajor, setSelectedMajor] = useState(
        location.state?.selectedMajor ?? 'Empty-Major'
    );
    const [selectedMods, setSelectedMods] = useState(
        (location.state?.selectedMods ?? []).map(normalizeModuleCode).filter(Boolean)
    );
    const [customModules, setCustomModules] = useState(
        (location.state?.customModules ?? [])
            .map(normalizeCustomModuleRecord)
            .filter(Boolean)
    );
 
    const [allModules, setAllModules] = useState([]);    // full list from Supabase
    const [caseGRows, setCaseGRows] = useState([]);
    const [moduleDatabase, setModuleDatabase] = useState({}); // flat id→module dict
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [plannerModules, setPlannerModules] = useState(() => createEmptyPlannerModules());
    const [savingProfile, setSavingProfile] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null);
 
    // Fetch all modules from Supabase once on mount
    useEffect(() => {
        async function fetchModules() {
            setLoading(true);
            const { data, error } = await supabase
                .from('modules')
                .select('id,label,level,description,majors,not_rendered,compulsory_for,or_group_id,is_pillar,is_single_module_pillar,pillar_label,is_level4000_pathway,options,"is_requirement_group","Requirements","RequirementsPillar"');

            if (error) {
                console.error('Error fetching modules:', error);
                setError('Failed to load modules. Please refresh.');
            } else {
                const modules = [];
                const caseG = [];

                (data ?? []).forEach((row) => {
                    const caseGRow = normalizeCaseGRow(row);
                    if (caseGRow) {
                        caseG.push(caseGRow);
                        return;
                    }

                    modules.push(rowToModule(row));
                });

                setAllModules(modules);
                setCaseGRows(caseG);
                setModuleDatabase(buildDatabase(modules));
            }
            setLoading(false);
        }
 
        fetchModules();
    }, []);
 
    // Restore scroll / state when navigating back
    useEffect(() => {
        const savedState = location.state?.moduleTreeState;
        if (savedState) {
            const restoreFrame = window.requestAnimationFrame(() => {
                setSelectedMajor(savedState.selectedMajor ?? 'Empty-Major');
                setSelectedMods(Array.isArray(savedState.selectedMods)
                    ? savedState.selectedMods.map(normalizeModuleCode).filter(Boolean)
                    : []);
                setCustomModules(Array.isArray(savedState.customModules)
                    ? savedState.customModules.map(normalizeCustomModuleRecord).filter(Boolean)
                    : []);
                setPlannerModules(normalizePlannerModules(savedState.plannerModules));
                if (typeof savedState.scrollPosition === 'number') {
                    window.scrollTo({ top: savedState.scrollPosition });
                }
            });

            return () => window.cancelAnimationFrame(restoreFrame);
        }
    }, [location.state]);

    useEffect(() => {
        const userId = session?.user?.id;

        if (location.state?.moduleTreeState || !userId) {
            return;
        }

        let cancelled = false;

        const restoreProfileState = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('modtree_state')
                .eq('id', userId)
                .maybeSingle();

            if (cancelled) {
                return;
            }

            if (error) {
                console.error('Error loading saved ModTree state:', error);
                return;
            }

            const restoredState = normalizeSavedModTreeState(data?.modtree_state);
            if (!restoredState) {
                return;
            }

            setSelectedMajor(restoredState.selectedMajor);
            setSelectedMods(restoredState.selectedMods);
            setCustomModules(restoredState.customModules);
            setPlannerModules(restoredState.plannerModules);
        };

        restoreProfileState();

        return () => {
            cancelled = true;
        };
    }, [location.state, session?.user?.id]);
 
    const handleToggleModule = (modId) => {
        const moduleCode = normalizeModuleCode(modId);
        setSelectedMods(current =>
            current.includes(moduleCode)
                ? current.filter(id => id !== moduleCode)
                : [...current, moduleCode]
        );
    };
 
    const handleClearSelectedMods = () => {
        setSelectedMods([]);
        setPlannerModules(() => createEmptyPlannerModules());
    };

    const handleAddCustomModule = (module) => {
        const moduleCode = normalizeModuleCode(module?.moduleCode);
        if (!moduleCode) {
            return;
        }

        setCustomModules(current =>
            current.some((entry) => entry.moduleCode === moduleCode)
                ? current
                : [...current, { ...module, moduleCode }]
        );
        setQuery(moduleCode.toUpperCase());
        setSuggestions([]);
    };

    const handleRemoveCustomModule = (moduleId) => {
        const moduleCode = normalizeModuleCode(moduleId);
        if (!moduleCode) {
            return;
        }

        setCustomModules(current => current.filter((entry) => entry.moduleCode !== moduleCode));
        setSelectedMods(current => current.filter((id) => id !== moduleCode));
        setPlannerModules(current => Object.fromEntries(
            Object.entries(current).map(([semester, semesterModules]) => [
                semester,
                (semesterModules ?? []).filter((id) => id !== moduleCode)
            ])
        ));
    };

    const plannerModuleIds = Object.values(plannerModules).flat();
    const basketVisibleMods = selectedMods.filter(id => !plannerModuleIds.includes(id));

    const handleDropModuleToSemester = (semester, moduleId) => {
        setPlannerModules(current => {
            if (!moduleId || current[semester]?.includes(moduleId)) {
                return current;
            }

            return {
                ...current,
                [semester]: [...(current[semester] ?? []), moduleId]
            };
        });

        setSelectedMods(current => (current.includes(moduleId) ? current : [...current, moduleId]));
    };

    const moveModulesToBasket = (moduleIds = []) => {
        const uniqueModuleIds = moduleIds.filter(Boolean);

        if (uniqueModuleIds.length === 0) {
            return;
        }

        setSelectedMods(current => {
            const next = current.filter(id => !uniqueModuleIds.includes(id));
            return [...next, ...uniqueModuleIds];
        });
    };

    const handleRemoveModuleFromPlanner = (moduleId) => {
        if (!moduleId) {
            return;
        }

        setPlannerModules(current => {
            const nextPlannerModules = Object.fromEntries(
                Object.entries(current).map(([semester, semesterModules]) => [
                    semester,
                    (semesterModules ?? []).filter(id => id !== moduleId)
                ])
            );

            return nextPlannerModules;
        });

        moveModulesToBasket([moduleId]);
    };

    const handleClearSemesterModules = (semester) => {
        const semesterModules = plannerModules[semester] ?? [];

        if (semesterModules.length === 0) {
            return;
        }

        setPlannerModules(current => ({
            ...current,
            [semester]: []
        }));

        moveModulesToBasket(semesterModules);
    };

    const handleSaveSelectedModules = async () => {
        setSavingProfile(true);
        setSaveStatus(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setSavingProfile(false);
            setSaveStatus('error');
            return;
        }

        const { data: existingProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('past_grades')
            .eq('id', user.id)
            .maybeSingle();

        if (fetchError) {
            console.error('Error loading existing profile modules:', fetchError);
            setSavingProfile(false);
            setSaveStatus('error');
            return;
        }

        const existingPastGrades = Array.isArray(existingProfile?.past_grades)
            ? existingProfile.past_grades
            : [];
        const nextModtreeState = buildPersistedModTreeState({
            selectedMajor,
            selectedMods,
            customModules,
            plannerModules,
        });
        const gradesByModuleCode = new Map(
            existingPastGrades
                .filter((entry) => entry && typeof entry === 'object' && typeof entry.moduleCode === 'string')
                .map((entry) => [entry.moduleCode, entry])
        );

        selectedMods.forEach((moduleCode) => {
            const normalizedCode = typeof moduleCode === 'string' ? moduleCode.trim().toUpperCase() : '';
            if (!normalizedCode || gradesByModuleCode.has(normalizedCode)) {
                return;
            }

            gradesByModuleCode.set(normalizedCode, {
                moduleCode: normalizedCode,
                grade: '',
            });
        });

        const nextPastGrades = Array.from(gradesByModuleCode.values());

        const { error: saveError } = await supabase.from('profiles').upsert({
            id: user.id,
            past_grades: nextPastGrades,
            modtree_state: nextModtreeState,
        });

        if (saveError) {
            console.error('Error saving selected modules to profile:', saveError);
        }

        setSavingProfile(false);
        setSaveStatus(saveError ? 'error' : 'success');
    };

    const moduleTreeState = useMemo(
        () => ({ selectedMajor, selectedMods, customModules, plannerModules }),
        [selectedMajor, selectedMods, customModules, plannerModules]
    );

    const filteredModules = useMemo(() =>
        allModules.filter(mod => mod.majors && mod.majors.includes(selectedMajor)),
        [allModules, selectedMajor]
    );

    const orGroupDisplayLevels = useMemo(() => {
        const levelsByGroup = new Map();

        filteredModules.forEach((mod) => {
            if (!mod.orGroupId) {
                return;
            }

            const moduleLevel = Number(mod.level);
            if (!Number.isFinite(moduleLevel)) {
                return;
            }

            const currentLevel = levelsByGroup.get(mod.orGroupId);
            if (currentLevel === undefined || moduleLevel < currentLevel) {
                levelsByGroup.set(mod.orGroupId, moduleLevel);
            }
        });

        return levelsByGroup;
    }, [filteredModules]);
 
    const modulesByLvl = useMemo(() => [1000, 2000, 3000, 4000].map(lvl =>
        filteredModules.filter(mod => getModuleDisplayLevel(mod, orGroupDisplayLevels) === lvl)
    ), [filteredModules, orGroupDisplayLevels]);

    const caseGRow = useMemo(() => {
        if (selectedMajor === 'Empty-Major') {
            return null;
        }

        return caseGRows.find((row) => Array.isArray(row.majors) && row.majors.includes(selectedMajor)) ?? null;
    }, [caseGRows, selectedMajor]);
 
    if (loading) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                    Loading modules…
                </div>
            );
    }
 
    if (error) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#c0392b' }}>
                {error}
            </div>
        );
    }
 
    return (
        <div className="min-h-screen bg-[#F7F6F2]">
                    <div style={{ marginBottom: '16px'}}>
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        backgroundColor: '#fff',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1f2937'
                    }}
                >
                    Back
                </button>
            </div>
            <div style={{ fontFamily: 'sans-serif', padding: '40px', backgroundColor: '#F7F6F2', width: '100%', boxSizing: 'border-box', position: 'center', }}>
                <SelectMajor selectedMajor={selectedMajor} onMajorChange={setSelectedMajor} />

                <div style={{ width: '100%', maxWidth: 'calc(100vw - 320px)', margin: '0 auto', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <div style={{ width: '100%', maxWidth: '1160px' }}>
                            <div style={{ marginBottom: '18px' }}>
                                <ModTreeSearchBar
                                    query={query}
                                    onChange={setQuery}
                                    suggestions={suggestions}
                                    onSelect={handleAddCustomModule}
                                    onDismiss={() => {
                                        setQuery('');
                                        setSuggestions([]);
                                    }}
                                    loading={searchLoading}
                                />
                                {searchError ? (
                                    <div style={{ marginTop: '8px', color: '#D85A30', fontSize: '12px' }}>
                                        {searchError}
                                    </div>
                                ) : null}
                            </div>
                            {selectedMajor !== 'Empty-Major' ? (
                                <>
                                    <ModuleTree
                                        modulesByLvl={modulesByLvl}
                                        selectedMods={selectedMods}
                                        selectedMajor={selectedMajor}
                                        moduleTreeState={moduleTreeState}
                                        onToggleModule={handleToggleModule}
                                        customModules={customModules}
                                        onRemoveCustomModule={handleRemoveCustomModule}
                                    />
                                    <CaseGRequirements row={caseGRow} selectedMajor={selectedMajor} />
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontStyle: 'italic' }}>
                                    Please select a major from the dropdown above to display your graduation pathway tree.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
                    {saveStatus === 'success' && (
                        <div style={{ color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontWeight: '600' }}>
                            Saved selected modules to your profile.
                        </div>
                    )}
                    {saveStatus === 'error' && (
                        <div style={{ color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontWeight: '600' }}>
                            Could not save selected modules. Please try again.
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleSaveSelectedModules}
                        disabled={savingProfile || selectedMods.length === 0}
                        style={{
                            padding: '12px 22px',
                            borderRadius: '999px',
                            border: 'none',
                            backgroundColor: selectedMods.length === 0 ? '#cbd5e1' : '#E95420',
                            color: '#ffffff',
                            cursor: savingProfile || selectedMods.length === 0 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: '700',
                            boxShadow: '0 4px 12px rgba(233, 84, 32, 0.18)',
                        }}
                    >
                        {savingProfile ? 'Saving...' : 'Save selected modules to profile'}
                    </button>
                </div>

                <div style={{ position: 'fixed', top: '120px', right: '16px', width: '200px', maxWidth: 'calc(100vw - 32px)', zIndex: 50 }}>
                    <SelectedBasket
                        selectedMods={basketVisibleMods}
                        selectedMajor={selectedMajor}
                        moduleDatabase={moduleDatabase}
                        moduleTreeState={moduleTreeState}
                        onToggleModule={handleToggleModule}
                        onClearAll={handleClearSelectedMods}
                    />
                </div>
            </div>


            <AcadsPlanner
                plannerModules={plannerModules}
                selectedMods={selectedMods}
                selectedMajor={selectedMajor}
                moduleDatabase={moduleDatabase}
                moduleTreeState={moduleTreeState}
                onDropModuleToSemester={handleDropModuleToSemester}
                onClearSemesterModules={handleClearSemesterModules}
                onRemoveModuleFromPlanner={handleRemoveModuleFromPlanner}
                onToggleModule={handleToggleModule}
                semesterLabels={PLANNER_COLUMN_LABELS}
            />
        </div>
    );
}
