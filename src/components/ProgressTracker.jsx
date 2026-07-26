import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';
import { normalizeModuleCode } from './ModTree_components/modTreeModuleData';
import ModuleTree from './ModTree_components/ModTree_ModTree';
import ModuleButton from './ModTree_components/ModTree_ModButton';
import ModTreeProgressBar from './ModTree_components/ModTree_ProgressBar';
import { analyzeLevel4000Pathway } from './ModTree_components/ModTree_MultiLayerButtonLogic';
import "@fontsource/league-spartan/700.css";

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

function getLayerCompletionMetrics(layer, selectedMods) {
    const orGroupIds = [...new Set(layer.map((mod) => mod.orGroupId).filter(Boolean))];
    const requirements = [];

    orGroupIds.forEach((groupId) => {
        const groupModules = layer.filter((mod) => mod.orGroupId === groupId);
        const anySelected = groupModules.some((groupMod) =>
            groupMod.isPillar
                ? groupMod.options?.some((option) => selectedMods.includes(option.id))
                : selectedMods.includes(groupMod.id)
        );
        requirements.push(anySelected);
    });

    layer.filter((mod) => !mod.orGroupId).forEach((mod) => {
        if (mod.isPillar) {
            requirements.push(Boolean(mod.options?.some((option) => selectedMods.includes(option.id))));
        } else if (mod.isRequirementGroup) {
            const pillars = Array.isArray(mod.RequirementsPillar) ? mod.RequirementsPillar : [];
            requirements.push(
                pillars.length > 0
                && pillars.every((pillar) => Array.isArray(pillar.options)
                    && pillar.options.some((option) => selectedMods.includes(option.id)))
            );
        } else if (mod.isSingleModulePillar) {
            requirements.push(selectedMods.includes(mod.id));
        } else if (mod.isLevel4000Pathway) {
            requirements.push(analyzeLevel4000Pathway(mod, selectedMods).complete);
        } else {
            requirements.push(selectedMods.includes(mod.id));
        }
    });

    const totalCount = requirements.length;
    const completedCount = requirements.filter(Boolean).length;

    return {
        completedCount,
        totalCount,
    };
}

function rowToModule(row) {
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
        takenSections: Array.isArray(savedState.takenSections)
            ? savedState.takenSections
                .map((section, index) => {
                    if (!section || typeof section !== 'object') {
                        return null;
                    }

                    return {
                        id: typeof section.id === 'string' && section.id.trim()
                            ? section.id
                            : createSectionId(),
                        title: typeof section.title === 'string' ? section.title : '',
                        moduleCodes: Array.isArray(section.moduleCodes)
                            ? section.moduleCodes.map(normalizeModuleCode).filter(Boolean)
                            : [],
                        order: Number.isInteger(section.order) ? section.order : index,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.order - b.order)
                .map(({ order, ...section }) => section)
            : null,
    };
}

function getTakenModuleCodes(grades) {
    const gradeCodes = Array.isArray(grades)
        ? grades.map((row) => normalizeModuleCode(row?.moduleCode)).filter(Boolean)
        : [];

    return [...new Set(gradeCodes)].sort((a, b) => a.localeCompare(b));
}

function createSectionId() {
    return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTakenSection(title = '', moduleCodes = []) {
    return {
        id: createSectionId(),
        title,
        moduleCodes: Array.isArray(moduleCodes) ? moduleCodes : [],
    };
}

function getDefaultSecondarySectionTitle(selectedMajor) {
    const majorTitle = typeof selectedMajor === 'string' ? selectedMajor.trim() : '';
    return majorTitle || 'Major';
}

function createDefaultTakenSections(selectedMajor, fallbackModuleCodes = []) {
    return [
        createTakenSection('All modules taken', fallbackModuleCodes),
        createTakenSection(getDefaultSecondarySectionTitle(selectedMajor), []),
    ];
}

const FUTURE_SECTION_PLACEHOLDER = 'minor/specialisation/special programme';

function normalizeTakenSections(savedSections, selectedMajor, fallbackModuleCodes = []) {
    if (Array.isArray(savedSections) && savedSections.length > 0) {
        const normalized = savedSections.map((section, index) => ({
            id: typeof section?.id === 'string' && section.id.trim() ? section.id : createSectionId(),
            title: typeof section?.title === 'string' ? section.title : '',
            moduleCodes: Array.isArray(section?.moduleCodes)
                ? section.moduleCodes.map(normalizeModuleCode).filter(Boolean)
                : [],
            order: Number.isInteger(section?.order) ? section.order : index,
        }))
        .sort((a, b) => a.order - b.order)
        .map(({ order, ...section }) => section);

        return normalized;
    }

    return createDefaultTakenSections(selectedMajor, fallbackModuleCodes);
}

export default function ProgressTracker() {
    const navigate = useNavigate();
    const { session } = UserAuth();
    const [loading, setLoading] = useState(true);
    const [allModules, setAllModules] = useState([]);
    const [selectedMajor, setSelectedMajor] = useState('Empty-Major');
    const [selectedMods, setSelectedMods] = useState([]);
    const [customModules, setCustomModules] = useState([]);
    const [takenSections, setTakenSections] = useState(
        createDefaultTakenSections('Empty-Major', [])
    );
    const [trackerReady, setTrackerReady] = useState(false);
    const savedModTreeStateRef = useRef({});

    useEffect(() => {
        let cancelled = false;

        async function loadTrackerState() {
            setLoading(true);

            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id ?? session?.user?.id;

            const modulesPromise = supabase
                .from('modules')
                .select('id,label,level,description,majors,not_rendered,or_group_id,is_pillar,is_single_module_pillar,pillar_label,is_level4000_pathway,options,"is_requirement_group","Requirements","RequirementsPillar"');

            const profilePromise = userId
                ? supabase
                    .from('profiles')
                    .select('major,past_grades,modtree_state')
                    .eq('id', userId)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null });

            const [{ data: moduleRows, error: moduleError }, profileResult] = await Promise.all([
                modulesPromise,
                profilePromise,
            ]);

            if (cancelled) {
                return;
            }

            if (moduleError) {
                console.error('Error loading progress tracker modules:', moduleError);
                setLoading(false);
                return;
            }

            const modules = [];
            (moduleRows ?? []).forEach((row) => {
                const caseGRow = normalizeCaseGRow(row);
                if (caseGRow) {
                    return;
                }

                modules.push(rowToModule(row));
            });

            const restoredState = normalizeSavedModTreeState(profileResult?.data?.modtree_state);
            const rawSavedState = profileResult?.data?.modtree_state ?? {};
            const profileMajor = profileResult?.data?.major ?? 'Empty-Major';
            const profileGrades = Array.isArray(profileResult?.data?.past_grades) ? profileResult.data.past_grades : [];
            const profileTakenCodes = getTakenModuleCodes(profileGrades);

            setAllModules(modules);
            setSelectedMajor(restoredState?.selectedMajor ?? profileMajor);
            setSelectedMods(restoredState?.selectedMods ?? []);
            setCustomModules(restoredState?.customModules ?? []);
            setTakenSections(
                normalizeTakenSections(restoredState?.takenSections, restoredState?.selectedMajor ?? profileMajor, profileTakenCodes)
            );
            savedModTreeStateRef.current = rawSavedState;
            setTrackerReady(true);
            setLoading(false);
        }

        loadTrackerState();

        return () => {
            cancelled = true;
        };
    }, [session?.user?.id]);

    const filteredModules = useMemo(() =>
        allModules.filter((mod) => mod.majors && mod.majors.includes(selectedMajor)),
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

    const modulesByLvl = useMemo(() => [1000, 2000, 3000, 4000].map((lvl) =>
        filteredModules.filter((mod) => getModuleDisplayLevel(mod, orGroupDisplayLevels) === lvl)
    ), [filteredModules, orGroupDisplayLevels]);

    const progressMetrics = useMemo(() => {
        return modulesByLvl.reduce((accumulator, layer) => {
            const metrics = getLayerCompletionMetrics(layer, selectedMods);
            accumulator.completedCount += metrics.completedCount;
            accumulator.totalCount += metrics.totalCount;
            return accumulator;
        }, { completedCount: 0, totalCount: 0 });
    }, [modulesByLvl, selectedMods]);

    const moduleTreeState = useMemo(
        () => ({ selectedMajor, selectedMods, customModules, plannerModules: {} }),
        [selectedMajor, selectedMods, customModules]
    );

    const addTakenSection = () => {
        setTakenSections((current) => [
            ...current,
            createTakenSection('', []),
        ]);
    };

    const updateSectionTitle = (sectionId, title) => {
        setTakenSections((current) =>
            current.map((section) => (
                section.id === sectionId
                    ? { ...section, title }
                    : section
            ))
        );
    };

    const moveTakenModule = (moduleCode, sourceSectionId, targetSectionId) => {
        const normalizedCode = normalizeModuleCode(moduleCode);
        if (!normalizedCode || !sourceSectionId || !targetSectionId) {
            return;
        }

        setTakenSections((current) => {
            const sourceSectionIndex = current.findIndex((section) => section.id === sourceSectionId);
            const targetSectionIndex = current.findIndex((section) => section.id === targetSectionId);

            if (sourceSectionIndex === -1 || targetSectionIndex === -1) {
                return current;
            }

            if (sourceSectionId === targetSectionId) {
                return current;
            }

            const next = current.map((section) => ({
                ...section,
                moduleCodes: Array.isArray(section.moduleCodes) ? [...section.moduleCodes] : [],
            }));

            next[sourceSectionIndex].moduleCodes = next[sourceSectionIndex].moduleCodes.filter(
                (code) => normalizeModuleCode(code) !== normalizedCode
            );

            if (!next[targetSectionIndex].moduleCodes.some((code) => normalizeModuleCode(code) === normalizedCode)) {
                next[targetSectionIndex].moduleCodes = [...next[targetSectionIndex].moduleCodes, normalizedCode];
            }

            return next;
        });
    };

    const deleteTakenSection = (sectionId) => {
        if (!sectionId) {
            return;
        }

        setTakenSections((current) => {
            if (current.length <= 1) {
                return current;
            }

            const primarySection = current[0];
            const sectionToDelete = current.find((section) => section.id === sectionId);

            if (!sectionToDelete || sectionToDelete.id === primarySection.id) {
                return current;
            }

            const mergedPrimaryModules = [
                ...(primarySection.moduleCodes ?? []),
                ...(sectionToDelete.moduleCodes ?? []),
            ].map(normalizeModuleCode).filter(Boolean);

            const dedupedPrimaryModules = [...new Set(mergedPrimaryModules)];

            return current
                .filter((section) => section.id !== sectionId)
                .map((section, index) => (
                    index === 0
                        ? { ...section, moduleCodes: dedupedPrimaryModules }
                        : section
                ));
        });
    };

    useEffect(() => {
        const userId = session?.user?.id;
        if (!trackerReady || !userId || loading) {
            return;
        }

        const timer = window.setTimeout(async () => {
            const nextModtreeState = {
                ...savedModTreeStateRef.current,
                selectedMajor,
                selectedMods,
                customModules,
                takenSections: takenSections.map((section, index) => ({
                    id: section.id,
                    title: section.title,
                    moduleCodes: Array.isArray(section.moduleCodes) ? section.moduleCodes : [],
                    order: index,
                })),
            };

            const { error } = await supabase.from('profiles').upsert({
                id: userId,
                modtree_state: nextModtreeState,
            });

            if (error) {
                console.error('Error saving Progress Tracker state:', error);
                return;
            }

            savedModTreeStateRef.current = nextModtreeState;
        }, 500);

        return () => window.clearTimeout(timer);
    }, [
        session?.user?.id,
        trackerReady,
        loading,
        selectedMajor,
        selectedMods,
        customModules,
        takenSections,
    ]);

    return (
        <div className="min-h-screen bg-[#F7F6F2] flex flex-col">
            <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
                <h1
                    className="cursor-pointer text-[#F76F44]"
                    style={{ fontFamily: "League Spartan", fontWeight: 700 }}
                    onClick={() => navigate("/dashboard")}
                >
                    What<span style={{ color: "#2564F8" }}>To</span>Mod
                </h1>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition"
                >
                    ← Back
                </button>
            </header>

            <main style={{ flex: 1, width: '100%' }}>
                <div style={{ fontFamily: 'sans-serif', padding: '24px', paddingRight: '150px', backgroundColor: '#F7F6F2', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ marginBottom: '18px' }}>
                        <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#2564F8', margin: 0 }}>
                            Progress Tracker
                        </h2>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>
                            {session?.user?.email}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <ModTreeProgressBar
                            completed={progressMetrics.completedCount}
                            total={progressMetrics.totalCount}
                        />

                        {loading ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                                Loading progress tracker…
                            </div>
                        ) : (
                            <ModuleTree
                                modulesByLvl={modulesByLvl}
                                selectedMods={selectedMods}
                                selectedMajor={selectedMajor}
                                moduleTreeState={moduleTreeState}
                                onToggleModule={() => {}}
                                customModules={customModules}
                                customModuleEmptyMessage="No custom modules saved."
                            />
                        )}

                        <section
                            style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid rgba(0,0,0,0.08)',
                                borderRadius: '16px',
                                padding: '16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a18' }}>
                                        All Modules Taken
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                        Catgorize your taken modules into the degree requirements that it fulfils!
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                        Drag module cards between sections below.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addTakenSection}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '999px',
                                        border: '1px solid rgba(24, 95, 165, 0.24)',
                                        backgroundColor: '#E6F1FB',
                                        color: '#185FA5',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                    }}
                                >
                                    + Add section
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {takenSections.map((section, sectionIndex) => {
                                    const sectionModules = section.moduleCodes ?? [];

                                    return (
                                        <div
                                            key={section.id}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                const moduleCode = event.dataTransfer.getData('text/plain');
                                                const sourceSectionId = event.dataTransfer.getData('application/x-section-id');
                                                if (moduleCode && sourceSectionId) {
                                                    moveTakenModule(moduleCode, sourceSectionId, section.id);
                                                }
                                            }}
                                            style={{
                                                border: '1px solid rgba(0,0,0,0.14)',
                                                borderRadius: '14px',
                                                padding: '12px',
                                                backgroundColor: '#FCFCFB',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                <input
                                                    type="text"
                                                    value={section.title}
                                                    onChange={(event) => updateSectionTitle(section.id, event.target.value)}
                                                    placeholder={sectionIndex === 0 ? 'All modules taken' : FUTURE_SECTION_PLACEHOLDER}
                                                    style={{
                                                        width: '100%',
                                                        border: 'none',
                                                        borderBottom: '1px solid rgba(0,0,0,0.12)',
                                                        backgroundColor: 'transparent',
                                                        color: '#1a1a18',
                                                        fontSize: '13px',
                                                        fontWeight: '700',
                                                        outline: 'none',
                                                        padding: '4px 0',
                                                    }}
                                                />
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                                    {sectionModules.length} modules
                                                </span>
                                                {sectionIndex > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteTakenSection(section.id)}
                                                        style={{
                                                            border: '1px solid rgba(216, 90, 48, 0.24)',
                                                            backgroundColor: '#FAECE7',
                                                            color: '#D85A30',
                                                            borderRadius: '999px',
                                                            padding: '6px 10px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            cursor: 'pointer',
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                ) : null}
                                            </div>

                                            {sectionModules.length === 0 ? (
                                                <div
                                                    style={{
                                                        border: '1px dashed rgba(0,0,0,0.12)',
                                                        borderRadius: '10px',
                                                        padding: '12px',
                                                        color: '#6b7280',
                                                        fontSize: '12px',
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    Drop modules here.
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                    {sectionModules.map((moduleCode) => (
                                                        <ModuleButton
                                                            key={`${section.id}-${moduleCode}`}
                                                            moduleCode={moduleCode}
                                                            isSelected={true}
                                                            moduleTreeState={moduleTreeState}
                                                            compact
                                                            draggable
                                                            onDragStart={(event) => {
                                                                event.dataTransfer.setData('text/plain', moduleCode);
                                                                event.dataTransfer.setData('application/x-section-id', section.id);
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
