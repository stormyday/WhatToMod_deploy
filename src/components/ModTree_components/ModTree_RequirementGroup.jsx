import PillarDropdown from './ModTree_PillarMod';

function extractQuotedSegments(text) {
    const matches = [];
    const pattern = /"((?:\\.|[^"\\])*)"/g;

    let match = pattern.exec(text);
    while (match) {
        matches.push(match[1].replace(/\\"/g, '"').trim());
        match = pattern.exec(text);
    }

    return matches.filter((segment) => segment.length > 0);
}

function normalizeRequirementEntry(entry) {
    if (typeof entry !== 'string') {
        return [];
    }

    const trimmed = entry.trim();
    if (!trimmed) {
        return [];
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.flatMap(normalizeRequirementEntry);
            }
        } catch {
            // Fall through to the quoted-string parser below.
        }
    }

    const quotedSegments = extractQuotedSegments(trimmed);
    if (quotedSegments.length > 1) {
        return quotedSegments;
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const braceSegments = extractQuotedSegments(trimmed);
        if (braceSegments.length > 0) {
            return braceSegments;
        }
    }

    return [trimmed];
}

function normalizeRequirements(requirements) {
    if (Array.isArray(requirements)) {
        return requirements.flatMap(normalizeRequirementEntry);
    }

    if (typeof requirements === 'string') {
        return normalizeRequirementEntry(requirements);
    }

    return [];
}

function RequirementsList({ requirements = [] }) {
    const normalizedRequirements = normalizeRequirements(requirements);

    if (normalizedRequirements.length === 0) {
        return null;
    }

    return (
        <ul
            style={{
                margin: 0,
                padding: '0 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxSizing: 'border-box',
            }}
        >
            {normalizedRequirements.map((requirement, index) => (
                <li
                    key={`${index}-${requirement}`}
                    style={{
                        color: '#5F5E5A',
                        fontSize: '11px',
                        lineHeight: 1.5,
                        textAlign: 'justify',
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
    const requirements = nodeData?.Requirements;
    const pillars = Array.isArray(nodeData?.RequirementsPillar) ? nodeData.RequirementsPillar : [];

    return (
        <div
            style={{
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '14px',
                padding: '12px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                maxWidth: '420px',
                margin: '0 auto',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
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

            <div
                style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}
            >
                <div
                    style={{
                        color: '#5F5E5A',
                        fontSize: '11px',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                    }}
                >
                    Requirements:
                </div>

                <RequirementsList requirements={requirements} />
            </div>

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
