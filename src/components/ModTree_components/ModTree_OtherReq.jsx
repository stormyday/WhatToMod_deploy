function normalizeCaseGNotes(notes) {
    if (!Array.isArray(notes)) {
        return [];
    }

    return notes.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

export default function CaseGRequirements({ row, selectedMajor }) {
    const notes = normalizeCaseGNotes(row?.notRendered ?? row?.not_rendered);
    const title = row?.label ?? 'Not Rendered';

    if (
        !row
        || selectedMajor === 'Empty-Major'
        || !Array.isArray(row.majors)
        || !row.majors.includes(selectedMajor)
        || notes.length === 0
    ) {
        return null;
    }

    return (
        <section
            style={{
                marginTop: '18px',
                border: '1px solid rgba(0,0,0,0.1)',
                borderRadius: '16px',
                padding: '16px 18px',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                boxSizing: 'border-box',
                width: '100%',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                    width: '100%',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        width: '100%',
                        textAlign: 'center',
                    }}
                >
                    <div
                        style={{
                            color: '#1f2937',
                            fontSize: '14px',
                            fontWeight: '600',
                            textAlign: 'center',
                            width: '100%',
                        }}
                    >
                        Additional Requirements
                    </div>
                </div>
            </div>

            <ul
                style={{
                    margin: 0,
                    padding: '0 0 0 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxSizing: 'border-box',
                }}
            >
                {notes.map((note, index) => (
                    <li
                        key={`${row.id}-${index}`}
                        style={{
                            color: '#5F5E5A',
                            fontSize: '12px',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            textAlign: 'justify',
                            textJustify: 'inter-word',
                        }}
                    >
                        {note}
                    </li>
                ))}
            </ul>
        </section>
    );
}
