import SelectionBasketButton from './ModTree_SelectionBasketButton';

const DEFAULT_PLANNER_COLUMNS = ['Precluded Modules', 'Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];

export default function AcadsPlanner({
    plannerModules,
    selectedMods,
    selectedMajor,
    moduleDatabase,
    moduleTreeState,
    onDropModuleToSemester,
    onClearSemesterModules,
    onRemoveModuleFromPlanner,
    onToggleModule,
    semesterLabels = DEFAULT_PLANNER_COLUMNS,
}) {
    const priorSemesterModuleCodes = new Set();

    return (
        <section>
            <div style={{ marginTop: '50vh', fontSize: '32px', fontWeight: '600', color: '#1f2937', marginBottom: '12px', paddingLeft: '16px' }}>
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
                    {semesterLabels.map((label) => {
                        const semesterModules = plannerModules[label] ?? [];
                        const availableModuleCodes = Array.from(priorSemesterModuleCodes);
                        semesterModules.forEach((moduleId) => {
                            if (moduleId) {
                                priorSemesterModuleCodes.add(moduleId);
                            }
                        });

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
                                        onDropModuleToSemester(label, draggedModuleId);
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
                                        onClick={() => onClearSemesterModules(label)}
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
                                <div
                                    style={{
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
                                    }}
                                >
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
                                                        onToggle={() => onToggleModule(moduleId)}
                                                        onRemove={() => onRemoveModuleFromPlanner(moduleId)}
                                                        moduleTreeState={moduleTreeState}
                                                        fullWidth
                                                        availableModuleCodes={availableModuleCodes}
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
        </section>
    );
}
