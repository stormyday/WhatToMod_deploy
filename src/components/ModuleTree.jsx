import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SelectMajor from './ModTree_components/ModTree_SelectMajor';
import ModuleTree from './ModTree_components/ModTree_ModTree';
import SelectedBasket from './ModTree_components/ModTree_SelectionBasket';
import SelectionBasketButton from './ModTree_components/ModTree_SelectionBasketButton';

const SEMESTER_LABELS = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];

function createEmptyPlannerModules(labels = SEMESTER_LABELS) {
    return Object.fromEntries(labels.map(label => [label, []]));
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
        optionA: row.option_a ?? undefined,
        optionB: row.option_b ?? undefined,
    };
}
 
// Build the flat moduleDatabase dictionary from the list of modules
function buildDatabase(modules) {
    const db = {};
    modules.forEach(mod => {
        if (!db[mod.id]) db[mod.id] = mod;
 
        if (mod.isPillar && mod.options) {
            mod.options.forEach(opt => {
                if (!db[opt.id]) db[opt.id] = opt;
            });
        }
 
        if (mod.isLevel4000Pathway) {
            mod.optionA?.basket1?.options?.forEach(opt => { if (!db[opt.id]) db[opt.id] = opt; });
            mod.optionA?.basket2?.options?.forEach(opt => { if (!db[opt.id]) db[opt.id] = opt; });
            mod.optionB?.options?.forEach(opt => { if (!db[opt.id]) db[opt.id] = opt; });
        }
    });
    return db;
}
 
export default function ModuleTreePage() {
    const location = useLocation();
    const navigate = useNavigate();
 
    const [selectedMajor, setSelectedMajor] = useState(
        location.state?.selectedMajor ?? 'Empty-Major'
    );
    const [selectedMods, setSelectedMods] = useState(
        location.state?.selectedMods ?? []
    );
 
    const [allModules, setAllModules] = useState([]);    // full list from Supabase
    const [moduleDatabase, setModuleDatabase] = useState({}); // flat id→module dict
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [plannerModules, setPlannerModules] = useState(() => createEmptyPlannerModules());
 
    // Fetch all modules from Supabase once on mount
    useEffect(() => {
        async function fetchModules() {
            setLoading(true);
            const { data, error } = await supabase
                .from('modules')
                .select('*');
 
            if (error) {
                console.error('Error fetching modules:', error);
                setError('Failed to load modules. Please refresh.');
            } else {
                const modules = data.map(rowToModule);
                setAllModules(modules);
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
            setSelectedMajor(savedState.selectedMajor ?? 'Empty-Major');
            setSelectedMods(Array.isArray(savedState.selectedMods) ? savedState.selectedMods : []);
            if (typeof savedState.scrollPosition === 'number') {
                window.requestAnimationFrame(() =>
                    window.scrollTo({ top: savedState.scrollPosition })
                );
            }
        }
    }, [location.state]);
 
    const handleToggleModule = (modId) => {
        setSelectedMods(current =>
            current.includes(modId)
                ? current.filter(id => id !== modId)
                : [...current, modId]
        );
    };
 
    const handleClearSelectedMods = () => {
        setSelectedMods([]);
        setPlannerModules(() => createEmptyPlannerModules());
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
 
    const moduleTreeState = useMemo(() => ({ selectedMajor, selectedMods }), [selectedMajor, selectedMods]);

    const filteredModules = useMemo(() =>
        allModules.filter(mod => mod.majors && mod.majors.includes(selectedMajor)),
        [allModules, selectedMajor]
    );
 
    const modulesByLvl = useMemo(() => [1000, 2000, 3000, 4000].map(lvl =>
        filteredModules.filter(mod => mod.level === lvl)
    ), [filteredModules]);
 
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
                            {selectedMajor !== 'Empty-Major' ? (
                                <ModuleTree
                                    modulesByLvl={modulesByLvl}
                                    selectedMods={selectedMods}
                                    selectedMajor={selectedMajor}
                                    moduleTreeState={moduleTreeState}
                                    onToggleModule={handleToggleModule}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontStyle: 'italic' }}>
                                    Please select a major from the dropdown above to display your graduation pathway tree.
                                </div>
                            )}
                        </div>
                    </div>
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


            {/* Module planner */} {/*To be abstracted into its own component later */}
            <div style={{marginTop: '50vh', fontSize: '32px', fontWeight: '600', color: '#1f2937', marginBottom: '12px', paddingLeft: '16px' }}>
                Module Planner
            </div>
            <div
                style={{
                    marginBottom: '10vh',
                    padding: '24px 0 32px',
                    width: '100%',
                    overflowX: 'auto',
                    scrollbarWidth: 'thin',
                }}
            >
                <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content', paddingBottom: '8px' }}>
                    {SEMESTER_LABELS.map((label) => {
                        const semesterModules = plannerModules[label] ?? [];

                        return (
                            <div
                                key={label}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    event.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    const draggedModuleId = event.dataTransfer.getData('text/plain');
                                    if (draggedModuleId) {
                                        handleDropModuleToSemester(label, draggedModuleId);
                                    }
                                }}
                                style={{
                                    flex: '0 0 calc((100vw - 64px) / 3.5)',
                                    minWidth: '260px',
                                    maxWidth: '320px',
                                    padding: '16px',
                                    backgroundColor: '#ffffff',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '12px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#1f2937', letterSpacing: '0.02em' }}>
                                        {label}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#4b5563', fontWeight: '500' }}>
                                        Total MCs: {semesterModules.length * 4}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleClearSemesterModules(label)}
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '999px',
                                            border: '1px solid #d1d5db',
                                            backgroundColor: '#fff',
                                            color: '#4b5563',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div style={{
                                    minHeight: '320px',
                                    border: '1px dashed #cbd5e1',
                                    borderRadius: '8px',
                                    backgroundColor: '#f9fafb',
                                    padding: '12px',
                                    color: '#6b7280',
                                    fontSize: '13px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                }}>
                                    {semesterModules.length === 0 ? (
                                        <span>Drop modules here</span>
                                    ) : (
                                        semesterModules.map((moduleId) => {
                                            const moduleMeta = moduleDatabase[moduleId];
                                            const isCompulsoryInPlanner = moduleMeta?.compulsoryFor?.includes(selectedMajor);

                                            return (
                                                <div key={moduleId} style={{ width: '100%' }}>
                                                    <SelectionBasketButton
                                                        moduleCode={moduleId}
                                                        isSelected={selectedMods.includes(moduleId)}
                                                        isCompulsory={isCompulsoryInPlanner}
                                                        onToggle={() => handleToggleModule(moduleId)}
                                                        onRemove={() => handleRemoveModuleFromPlanner(moduleId)}
                                                        moduleTreeState={moduleTreeState}
                                                        fullWidth
                                                    />
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}