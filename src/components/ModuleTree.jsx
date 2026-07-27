import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';
import { normalizeModuleCode } from './ModTree_components/modTreeModuleData';
import {
    PLANNER_COLUMN_LABELS,
    buildDatabase,
    buildPersistedModTreeState,
    createEmptyPlannerModules,
    getModuleDisplayLevel,
    normalizeCaseGRow,
    normalizeCustomModuleRecord,
    normalizePlannerModules,
    readTemporaryModTreeState,
    normalizeSavedAcadsPlannerState,
    normalizeSavedModTreeState,
    saveTemporaryModTreeState,
    rowToModule,
} from './ModuleTree.helpers';
import SelectMajor from './ModTree_components/ModTree_SelectMajor';
import ModuleTree from './ModTree_components/ModTree_ModTree';
import CaseGRequirements from './ModTree_components/ModTree_OtherReq';
import SelectedBasket from './ModTree_components/ModTree_SelectionBasket';
import AcadsPlanner from './AcadsPlanner/ModTree_AcadsPlanner';
import { ModTreeSearchBar } from './ModTree_components/ModTree_SearchBar';
import { useModTreeModuleSearch } from '../hooks/useModTreeModuleSearch';
import "@fontsource/league-spartan/700.css";
 
export default function ModuleTreePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { session } = UserAuth();
    const initialTransientState = useMemo(() => {
        const routeState = location.state?.moduleTreeState ?? location.state;
        if (routeState && typeof routeState === 'object') {
            const normalizedRouteState = normalizeSavedModTreeState(routeState);
            if (normalizedRouteState) {
                return normalizedRouteState;
            }
        }

        return readTemporaryModTreeState();
    }, [location.state]);
    const {
        query,
        setQuery,
        suggestions,
        setSuggestions,
        loading: searchLoading,
        error: searchError,
    } = useModTreeModuleSearch();
 
    const [selectedMajor, setSelectedMajor] = useState(
        initialTransientState?.selectedMajor ?? 'Empty-Major'
    );
    const [selectedMods, setSelectedMods] = useState(
        (initialTransientState?.selectedMods ?? []).map(normalizeModuleCode).filter(Boolean)
    );
    const [customModules, setCustomModules] = useState(
        (initialTransientState?.customModules ?? [])
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
    const [savedModtreeState, setSavedModtreeState] = useState(() => initialTransientState);
    const [hasTemporaryStateReady, setHasTemporaryStateReady] = useState(
        Boolean(initialTransientState)
    );
 
    // Fetch all modules from Supabase once on mount
    useEffect(() => {
        async function fetchModules() {
            setLoading(true);
            const { data, error } = await supabase
                .from('modules')
                .select('id,label,level,description,majors,not_rendered,or_group_id,is_pillar,is_single_module_pillar,pillar_label,is_level4000_pathway,options,"is_requirement_group","Requirements","RequirementsPillar"');

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
                setSavedModtreeState((current) => current ?? {});
            }
            setLoading(false);
        }
 
        fetchModules();
    }, []);
 
    // Restore scroll / state when navigating back
    useEffect(() => {
        const savedState = initialTransientState;
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
            setSavedModtreeState(savedState);
            if (typeof savedState.scrollPosition === 'number') {
                window.scrollTo({ top: savedState.scrollPosition });
            }
        });

            return () => window.cancelAnimationFrame(restoreFrame);
        }
    }, [initialTransientState]);

    useEffect(() => {
        const userId = session?.user?.id;

        if (initialTransientState || !userId) {
            const readyTimer = window.setTimeout(() => {
                setHasTemporaryStateReady(true);
            }, 0);

            return () => window.clearTimeout(readyTimer);
        }

        let cancelled = false;

        const restoreProfileState = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('modtree_state, acads_planner_state')
                .eq('id', userId)
                .maybeSingle();

            if (cancelled) {
                return;
            }

            if (error) {
                console.error('Error loading saved ModTree state:', error);
                setHasTemporaryStateReady(true);
                return;
            }

            const restoredState = normalizeSavedModTreeState(data?.modtree_state);
            const restoredPlannerState = normalizeSavedAcadsPlannerState(data?.acads_planner_state);
            const hasSavedPlannerState = data?.acads_planner_state != null;

            if (restoredState) {
                setSelectedMajor(restoredState.selectedMajor);
                setSelectedMods(restoredState.selectedMods);
                setCustomModules(restoredState.customModules);
                setSavedModtreeState(restoredState);
            }

            setPlannerModules(hasSavedPlannerState
                ? restoredPlannerState
                : restoredState?.plannerModules ?? createEmptyPlannerModules());
            setHasTemporaryStateReady(true);
        };

        restoreProfileState();

        return () => {
            cancelled = true;
        };
    }, [initialTransientState, session?.user?.id]);
 
    const handleToggleModule = (modId) => {
        const moduleCode = normalizeModuleCode(modId);
        setSelectedMods(current =>
            current.includes(moduleCode)
                ? current.filter(id => id !== moduleCode)
                : [...current, moduleCode]
        );
    };
 
    const handleClearBasketModules = () => {
        setSelectedMods(current => current.filter((id) => plannerModuleIds.includes(id)));
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
            if (!moduleId) {
                return current;
            }

            const nextPlannerModules = Object.fromEntries(
                Object.entries(current).map(([currentSemester, semesterModules]) => [
                    currentSemester,
                    (semesterModules ?? []).filter((id) => id !== moduleId)
                ])
            );

            if (nextPlannerModules[semester]?.includes(moduleId)) {
                return nextPlannerModules;
            }

            return {
                ...nextPlannerModules,
                [semester]: [...(nextPlannerModules[semester] ?? []), moduleId]
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
            previousState: savedModtreeState ?? {},
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
        const nextAcadsPlannerState = normalizeSavedAcadsPlannerState({ plannerModules });

        const { error: saveError } = await supabase.from('profiles').upsert({
            id: user.id,
            past_grades: nextPastGrades,
            modtree_state: nextModtreeState,
            acads_planner_state: nextAcadsPlannerState,
        });

        if (saveError) {
            console.error('Error saving selected modules to profile:', saveError);
        } else {
            setSavedModtreeState(nextModtreeState);
        }

        setSavingProfile(false);
        setSaveStatus(saveError ? 'error' : 'success');
    };

    const moduleTreeState = useMemo(
        () => ({ selectedMajor, selectedMods, customModules, plannerModules }),
        [selectedMajor, selectedMods, customModules, plannerModules]
    );

    useEffect(() => {
        if (!hasTemporaryStateReady) {
            return;
        }

        saveTemporaryModTreeState(moduleTreeState);
    }, [hasTemporaryStateReady, moduleTreeState]);

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
        <div className="min-h-screen bg-[#F7F6F2] flex flex-col">
            <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                <h1
                    className="cursor-pointer text-[#F76F44]"
                    style={{ fontFamily: "League Spartan", fontWeight: 700 }}
                    onClick={() => navigate("/dashboard", { state: { moduleTreeState } })}
                >
                    What<span style={{ color: "#2564F8" }}>To</span>Mod
                </h1>
                <button
                    onClick={() => navigate('/dashboard', { state: { moduleTreeState } })}
                    className="text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition"
                >
                    ← Back
                </button>
            </header>

            <main style={{ flex: 1, width: '100%' }}>
                <div style={{ fontFamily: 'sans-serif', padding: '24px', paddingRight: '150px', backgroundColor: '#F7F6F2', width: '100%', boxSizing: 'border-box', position: 'center', }}>
                    <SelectMajor selectedMajor={selectedMajor} onMajorChange={setSelectedMajor} />

                    <div style={{ width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                            <div style={{ width: '100%', maxWidth: 'none' }}>
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
                                Saved selected modules and Acads Planner state to your profile.
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div style={{ color: '#b91c1c', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', fontWeight: '600' }}>
                                Could not save selected modules and Acads Planner state. Please try again.
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
                            {savingProfile ? 'Saving...' : 'Save modules and planner state to profile'}
                        </button>
                    </div>

                    <div style={{ position: 'fixed', top: '120px', right: '24px', width: '280px', maxWidth: 'calc(100vw - 48px)', zIndex: 50 }}>
                        <SelectedBasket
                            selectedMods={basketVisibleMods}
                            moduleTreeState={moduleTreeState}
                            onToggleModule={handleToggleModule}
                            onClearAll={handleClearBasketModules}
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
            </main>
        </div>
    );
}
