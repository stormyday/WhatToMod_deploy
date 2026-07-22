import PillarDropdown from './ModTree_PillarMod';

function RequirementsList({ requirements = [] }) {
    if (!Array.isArray(requirements) || requirements.length === 0) {
        return null;
    }

    return (
        <ul
            style={{
                margin: 0,
                paddingLeft: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
            }}
        >
            {requirements.map((requirement, index) => (
                <li
                    key={`${index}-${requirement}`}
                    style={{
                        color: '#5F5E5A',
                        fontSize: '12px',
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    {requirement}
                </li>
            ))}
        </ul>
    );
}

export default function RequirementGroup({
    nodeData,
    selectedMods,
    selectedMajor,
    moduleTreeState,
    onToggleModule,
}) {
    const requirements = Array.isArray(nodeData?.Requirements) ? nodeData.Requirements : [];
    const pillars = Array.isArray(nodeData?.RequirementsPillar) ? nodeData.RequirementsPillar : [];

    return (
        <div
            style={{
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '14px',
                padding: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                maxWidth: '360px',
                margin: '0 auto',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#185FA5',
                    textAlign: 'center',
                    fontWeight: '700',
                    fontSize: '13px',
                    gap: '6px',
                    flexWrap: 'wrap',
                }}
            >
                <span>{nodeData?.label ?? 'Requirement Group'}</span>
            </div>

            <RequirementsList requirements={requirements} />

            {pillars.length > 0 ? (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        alignItems: 'center',
                        width: '100%',
                    }}
                >
                    {pillars.map((pillar) => (
                        <PillarDropdown
                            key={pillar.id}
                            pillarModule={pillar}
                            selectedMods={selectedMods}
                            selectedMajor={selectedMajor}
                            moduleTreeState={moduleTreeState}
                            onToggleModule={onToggleModule}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
