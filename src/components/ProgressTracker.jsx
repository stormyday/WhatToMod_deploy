import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { UserAuth } from '../context/AuthContext';
import { normalizeModuleCode } from './ModTree_components/modTreeModuleData';
import { buildDatabase } from './ModuleTree.helpers';
import ModuleTree from './ModTree_components/ModTree_ModTree';
import ModuleButton from './ModTree_components/ModTree_ModButton';
import ModTreeProgressBar from './ModTree_components/ModTree_ProgressBar';
import { isUserModuleRecordComplete, loadUserModuleRecords } from '../utils/userModuleRecords';
import "@fontsource/league-spartan/700.css";

const SECTION_KINDS = ['all', 'major', 'second_major', 'minor', 'level', 'pool', 'custom'];

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
        takenSections: Array.isArray(savedState.takenSections) ? savedState.takenSections : null,
    };
}

function getTakenModuleCodes(records) {
    const recordCodes = Array.isArray(records)
        ? records
            .filter(isUserModuleRecordComplete)
            .map((row) => normalizeModuleCode(row?.moduleCode ?? row?.module_code))
            .filter(Boolean)
        : [];

    return [...new Set(recordCodes)].sort((a, b) => a.localeCompare(b));
}

function createSectionId() {
    return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTakenSection(title = '', moduleCodes = [], kind = 'custom') {
    return {
        id: createSectionId(),
        title,
        moduleCodes: Array.isArray(moduleCodes) ? moduleCodes : [],
        kind: SECTION_KINDS.includes(kind) ? kind : 'custom',
    };
}

function createDefaultTakenSections(fallbackModuleCodes = []) {
    return [createTakenSection('All modules taken', fallbackModuleCodes, 'all')];
}

function inferLegacyKind(title, { hasMaster, hasMajorSection, selectedMajor }) {
    const normalizedTitle = (title ?? '').trim().toLowerCase();

    if (!hasMaster && normalizedTitle === 'all modules taken') {
        return 'all';
    }

    if (!hasMajorSection && typeof selectedMajor === 'string' && selectedMajor !== 'Empty-Major'
        && normalizedTitle === selectedMajor.trim().toLowerCase()) {
        return 'major';
    }

    return 'custom';
}

function normalizeTakenSections(savedSections, selectedMajor, fallbackModuleCodes = []) {
    if (Array.isArray(savedSections) && savedSections.length > 0) {
        const withExplicitKind = savedSections.map((section, index) => ({
            id: typeof section?.id === 'string' && section.id.trim() ? section.id : createSectionId(),
            title: typeof section?.title === 'string' ? section.title : '',
            moduleCodes: Array.isArray(section?.moduleCodes)
                ? section.moduleCodes.map(normalizeModuleCode).filter(Boolean)
                : [],
            kind: SECTION_KINDS.includes(section?.kind) ? section.kind : null,
            order: Number.isInteger(section?.order) ? section.order : index,
        }));

        let hasMaster = withExplicitKind.some((section) => section.kind === 'all');
        let hasMajorSection = withExplicitKind.some((section) => section.kind === 'major');

        const withInferredKind = withExplicitKind.map((section) => {
            if (section.kind) {
                return section;
            }
            const inferred = inferLegacyKind(section.title, { hasMaster, hasMajorSection, selectedMajor });
            if (inferred === 'all') hasMaster = true;
            if (inferred === 'major') hasMajorSection = true;
            return { ...section, kind: inferred };
        });

        return withInferredKind
            .sort((a, b) => a.order - b.order)
            .map(({ id, title, moduleCodes, kind }) => ({ id, title, moduleCodes, kind }));
    }

    return createDefaultTakenSections(fallbackModuleCodes);
}

function ensureDefaultSections(sections, { selectedMajor, secondMajor, minor }) {
    let next = sections;

    if (!next.some((section) => section.kind === 'all')) {
        next = [createTakenSection('All modules taken', [], 'all'), ...next];
    }

    const majorTitle = typeof selectedMajor === 'string' && selectedMajor !== 'Empty-Major'
        ? selectedMajor.trim()
        : '';
    if (majorTitle && !next.some((section) => section.kind === 'major')) {
        next = [...next, createTakenSection(majorTitle, [], 'major')];
    }

    const secondMajorTitle = typeof secondMajor === 'string' ? secondMajor.trim() : '';
    if (secondMajorTitle && !next.some((section) => section.kind === 'second_major')) {
        next = [...next, createTakenSection(secondMajorTitle, [], 'second_major')];
    }

    const minorTitle = typeof minor === 'string' ? minor.trim() : '';
    if (minorTitle && !next.some((section) => section.kind === 'minor')) {
        next = [...next, createTakenSection(minorTitle, [], 'minor')];
    }

    return next;
}

function syncMasterSection(sections, takenModuleCodes) {
    return sections.map((section) => (
        section.kind === 'all'
            ? { ...section, moduleCodes: takenModuleCodes }
            : section
    ));
}

export default function ProgressTracker() {
    const navigate = useNavigate();
    const { session } = UserAuth();
    const [loading, setLoading] = useState(true);
    const [allModules, setAllModules] = useState([]);
    const [selectedMajor, setSelectedMajor] = useState('Empty-Major');
    const [selectedMods, setSelectedMods] = useState([]);
    const [customModules, setCustomModules] = useState([]);
    const [takenModuleCodes, setTakenModuleCodes] = useState([]);
    const [takenSections, setTakenSections] = useState(createDefaultTakenSections([]));
    const [hasCompletedModTree, setHasCompletedModTree] = useState(true);
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
                    .select('major,second_major,minor,modtree_state')
                    .eq('id', userId)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null });

            const recordsPromise = userId
                ? loadUserModuleRecords(userId).catch((recordError) => {
                    console.error('Error loading taken modules:', recordError);
                    return [];
                })
                : Promise.resolve([]);

            const [{ data: moduleRows, error: moduleError }, profileResult, userModuleRecords] = await Promise.all([
                modulesPromise,
                profilePromise,
                recordsPromise,
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
            const profileSecondMajor = profileResult?.data?.second_major ?? '';
            const profileMinor = profileResult?.data?.minor ?? '';
            const profileTakenCodes = getTakenModuleCodes(userModuleRecords);
            const savedMajor = restoredState?.selectedMajor;
            const effectiveMajor = savedMajor && savedMajor !== 'Empty-Major' ? savedMajor : profileMajor;
            const hasCompletedModTree = Boolean(
                restoredState && Array.isArray(restoredState.selectedMods) && restoredState.selectedMods.length > 0
            );

            const baseSections = normalizeTakenSections(restoredState?.takenSections, effectiveMajor, profileTakenCodes);
            const withDefaults = ensureDefaultSections(baseSections, {
                selectedMajor: effectiveMajor,
                secondMajor: profileSecondMajor,
                minor: profileMinor,
            });
            const syncedSections = syncMasterSection(withDefaults, profileTakenCodes);

            setAllModules(modules);
            setSelectedMajor(effectiveMajor);
            setSelectedMods(restoredState?.selectedMods ?? []);
            setCustomModules(restoredState?.customModules ?? []);
            setTakenModuleCodes(profileTakenCodes);
            setTakenSections(syncedSections);
            setHasCompletedModTree(hasCompletedModTree);
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

    const currentTreeModuleCodes = useMemo(() => {
        const treeDatabase = buildDatabase(filteredModules);
        return new Set([
            ...Object.keys(treeDatabase),
            ...customModules.map((module) => normalizeModuleCode(module.moduleCode)),
        ]);
    }, [filteredModules, customModules]);

    const progressMetrics = useMemo(() => {
        const relevantSelectedMods = selectedMods.filter((code) => currentTreeModuleCodes.has(code));
        return {
            completedCount: relevantSelectedMods.filter((code) => takenModuleCodes.includes(code)).length,
            totalCount: relevantSelectedMods.length,
        };
    }, [selectedMods, takenModuleCodes, currentTreeModuleCodes]);

    const moduleTreeState = useMemo(
        () => ({ selectedMajor, selectedMods, customModules, plannerModules: {} }),
        [selectedMajor, selectedMods, customModules]
    );

    const codeSectionMembership = useMemo(() => {
        const map = new Map();
        takenSections.forEach((section) => {
            if (section.kind === 'all' || section.kind === 'pool') {
                return;
            }
            (section.moduleCodes ?? []).forEach((code) => {
                if (!map.has(code)) {
                    map.set(code, []);
                }
                map.get(code).push({ id: section.id, title: section.title || 'Untitled' });
            });
        });
        return map;
    }, [takenSections]);

    const needsProfileSetup = selectedMajor === 'Empty-Major' || takenModuleCodes.length === 0;

    const addTakenSection = () => {
        setTakenSections((current) => [...current, createTakenSection('', [], 'custom')]);
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

    const addModuleToSection = (moduleCode, targetSectionId) => {
        const normalizedCode = normalizeModuleCode(moduleCode);
        if (!normalizedCode || !targetSectionId) {
            return;
        }

        setTakenSections((current) => current.map((section) => {
            if (section.id !== targetSectionId || section.kind === 'all') {
                return section;
            }
            if (section.moduleCodes.some((code) => normalizeModuleCode(code) === normalizedCode)) {
                return section;
            }
            return { ...section, moduleCodes: [...section.moduleCodes, normalizedCode] };
        }));
    };

    const removeModuleFromSection = (moduleCode, sectionId) => {
        const normalizedCode = normalizeModuleCode(moduleCode);
        if (!normalizedCode || !sectionId) {
            return;
        }

        setTakenSections((current) => current.map((section) => (
            section.id === sectionId && section.kind !== 'all'
                ? { ...section, moduleCodes: section.moduleCodes.filter((code) => normalizeModuleCode(code) !== normalizedCode) }
                : section
        )));
    };

    const deleteTakenSection = (sectionId) => {
        if (!sectionId) {
            return;
        }

        setTakenSections((current) => {
            const sectionToDelete = current.find((section) => section.id === sectionId);
            if (!sectionToDelete || sectionToDelete.kind === 'all') {
                return current;
            }

            return current.filter((section) => section.id !== sectionId);
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
                    kind: section.kind,
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
                        {loading ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#666' }}>
                                Loading progress tracker…
                            </div>
                        ) : needsProfileSetup ? (
                            <div
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid rgba(24, 95, 165, 0.2)',
                                    borderRadius: '16px',
                                    padding: '24px',
                                    textAlign: 'center',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                }}
                            >
                                <p style={{ margin: '0 0 14px', color: '#1a1a18', fontSize: '14px', fontWeight: '600' }}>
                                    Set your major and key in your grades on your Profile page to see your progress here!
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/profilePage')}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '999px',
                                        border: 'none',
                                        backgroundColor: '#2564F8',
                                        color: '#ffffff',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Go to Profile
                                </button>
                            </div>
                        ) : (
                            <>
                                <ModTreeProgressBar
                                    completed={progressMetrics.completedCount}
                                    total={progressMetrics.totalCount}
                                />

                                {!hasCompletedModTree && filteredModules.length > 0 ? (
                                    <div
                                        style={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid rgba(24, 95, 165, 0.2)',
                                            borderRadius: '16px',
                                            padding: '24px',
                                            textAlign: 'center',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                        }}
                                    >
                                        <p style={{ margin: '0 0 14px', color: '#1a1a18', fontSize: '14px', fontWeight: '600' }}>
                                            You haven't completed your modTree yet, go plan first to see your progress!
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/moduleTree')}
                                            style={{
                                                padding: '10px 20px',
                                                borderRadius: '999px',
                                                border: 'none',
                                                backgroundColor: '#2564F8',
                                                color: '#ffffff',
                                                fontSize: '13px',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Plan Now
                                        </button>
                                    </div>
                                ) : (
                                    <ModuleTree
                                        modulesByLvl={modulesByLvl}
                                        selectedMods={selectedMods}
                                        takenMods={takenModuleCodes}
                                        selectedMajor={selectedMajor}
                                        moduleTreeState={moduleTreeState}
                                        onToggleModule={() => {}}
                                        customModules={customModules}
                                        customModuleEmptyMessage="No custom modules saved."
                                    />
                                )}

                                <div
                                    onClick={() => navigate('/moduleTree')}
                                    className="mt-2 bg-white rounded-2xl border border-gray-200 px-7 py-5 text-center cursor-pointer hover:border-[#2564F8] transition"
                                >
                                    <p className="text-sm font-semibold text-gray-700">
                                        Incomplete modTree? <span className="text-[#2564F8]">Continue planning here →</span>
                                    </p>
                                </div>

                        <section
                            style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid rgba(0,0,0,0.08)',
                                borderRadius: '16px',
                                padding: '16px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#1a1a18' }}>
                                        All Modules Taken
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                        Catgorize your taken modules into the degree requirements that it fulfils!
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                        Drag and drop modules into the respective major/minor baskets! Double-counting is permitted.
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px', fontStyle: 'italic' }}>
                                        Only modules with grades and semesters inputted will be shown below.
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                                        + Add New Major/Minor Basket
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {takenSections.map((section) => {
                                    const sectionModules = section.moduleCodes ?? [];
                                    const isMaster = section.kind === 'all';

                                    return (
                                        <div
                                            key={section.id}
                                            onDragOver={(event) => {
                                                if (isMaster) {
                                                    return;
                                                }
                                                event.preventDefault();
                                                event.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={(event) => {
                                                if (isMaster) {
                                                    return;
                                                }
                                                event.preventDefault();
                                                const moduleCode = event.dataTransfer.getData('text/plain');
                                                if (moduleCode) {
                                                    addModuleToSection(moduleCode, section.id);
                                                }
                                            }}
                                            style={{
                                                border: isMaster ? 'none' : '1px solid rgba(0,0,0,0.14)',
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
                                                    placeholder="Untitled section"
                                                    readOnly={isMaster}
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
                                                {!isMaster ? (
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
                                                    {isMaster ? 'No graded modules yet.' : 'Drop modules here.'}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                    {sectionModules.map((moduleCode) => {
                                                        const memberships = codeSectionMembership.get(moduleCode) ?? [];

                                                        return (
                                                            <div key={`${section.id}-${moduleCode}`} style={{ position: 'relative' }}>
                                                                <ModuleButton
                                                                    moduleCode={moduleCode}
                                                                    isSelected={true}
                                                                    moduleTreeState={moduleTreeState}
                                                                    compact
                                                                    draggable
                                                                    showTooltip={false}
                                                                    onDragStart={(event) => {
                                                                        event.dataTransfer.setData('text/plain', moduleCode);
                                                                    }}
                                                                />
                                                                {memberships.length > 1 ? (
                                                                    <span
                                                                        title={`Counted in: ${memberships.map((entry) => entry.title).join(', ')}`}
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '-6px',
                                                                            right: '-6px',
                                                                            minWidth: '16px',
                                                                            height: '16px',
                                                                            borderRadius: '999px',
                                                                            backgroundColor: '#F59E0B',
                                                                            color: '#fff',
                                                                            fontSize: '9px',
                                                                            fontWeight: '800',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            padding: '0 3px',
                                                                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                                                        }}
                                                                    >
                                                                        {memberships.length}
                                                                    </span>
                                                                ) : null}
                                                                {!isMaster ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeModuleFromSection(moduleCode, section.id)}
                                                                        title="Remove from this section"
                                                                        style={{
                                                                            position: 'absolute',
                                                                            top: '-6px',
                                                                            left: '-6px',
                                                                            width: '16px',
                                                                            height: '16px',
                                                                            borderRadius: '999px',
                                                                            backgroundColor: '#fff',
                                                                            border: '1px solid rgba(0,0,0,0.16)',
                                                                            color: '#6b7280',
                                                                            fontSize: '10px',
                                                                            fontWeight: '800',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            lineHeight: 1,
                                                                            padding: 0,
                                                                        }}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                                <div
                                    onClick={() => navigate('/profilePage')}
                                    className="mt-2 bg-white rounded-2xl border border-gray-200 px-7 py-5 text-center cursor-pointer hover:border-[#2564F8] transition"
                                >
                                    <p className="text-sm font-semibold text-gray-700">
                                        Don't see all the modules you've taken? <span className="text-[#2564F8]">Add them here →</span>
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
