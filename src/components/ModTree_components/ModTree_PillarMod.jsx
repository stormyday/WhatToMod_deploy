import { useState } from 'react';
import ModuleButton from './ModTree_ModButton';

const OPTIONS_PER_COLUMN = 7;
const MAX_VISIBLE_COLUMNS = 1

function chunkOptions(options, chunkSize) {
    const chunks = [];
    for (let index = 0; index < options.length; index += chunkSize) {
        chunks.push(options.slice(index, index + chunkSize));
    }
    return chunks;
}

export default function PillarDropdown({ pillarModule, selectedMods, selectedMajor, moduleTreeState, onToggleModule }) {
    const [isOpen, setIsOpen] = useState(false);
    const compulsoryFor = pillarModule.compulsoryFor ?? pillarModule.compulsory_for ?? [];

    const selectedOption = pillarModule.options.find(opt => selectedMods.includes(opt.id));
    const optionColumns = chunkOptions(pillarModule.options, OPTIONS_PER_COLUMN);

    return (
        <div style={{
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '10px',
            padding: '10px',
            backgroundColor: '#ffffff',
            width: '150px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
            {/* Trigger button — shows selected module code if picked, otherwise pillar label */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    backgroundColor: selectedOption ? '#E1F5EE' : '#F7F6F2',
                    color: selectedOption ? '#1D9E75' : '#5F5E5A',
                    fontWeight: '600',
                    border: `1px solid ${selectedOption ? '#1D9E75' : 'rgba(0,0,0,0.1)'}`,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease-in-out',
                    fontSize: '12px'
                }}
            >
                <span>{selectedOption ? selectedOption.label : pillarModule.label}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Option list — auto-closes after a selection (single-pick UX) */}
            {isOpen && (
                <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '6px',
                    backgroundColor: '#F7F6F2',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.06)',
                    width: 'max-content',
                    minWidth: '100%',
                    alignSelf: 'flex-start',
                }}>
                    <p style={{ fontSize: '11px', margin: '0 0 5px 0', color: '#5F5E5A', fontWeight: '500' }}>
                        Select 1 Option:
                    </p>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'nowrap',
                        gap: '8px',
                        alignItems: 'flex-start',
                        overflowX: optionColumns.length > MAX_VISIBLE_COLUMNS ? 'auto' : 'visible',
                        maxWidth: optionColumns.length > MAX_VISIBLE_COLUMNS
                            ? `calc((150px * ${MAX_VISIBLE_COLUMNS}) + (8px * ${MAX_VISIBLE_COLUMNS - 1}))`
                            : 'none',
                        paddingBottom: optionColumns.length > 1 ? '2px' : 0,
                    }}>
                        {optionColumns.map((columnOptions, columnIndex) => (
                            <div
                                key={`pillar-column-${columnIndex}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    minWidth: 'fit-content',
                                }}
                            >
                                {columnOptions.map((option) => {
                                    const isSelected = selectedMods.includes(option.id);
                                    // Inherit compulsory status from the pillar, resolved against the active major.
                                    // Falls back gracefully if selectedMajor is not provided.
                                    const isCompulsory = selectedMajor
                                        ? compulsoryFor.includes(selectedMajor)
                                        : compulsoryFor.length > 0;
                                    return (
                                        <ModuleButton
                                            key={option.id}
                                            moduleCode={option.id}
                                            isSelected={isSelected}
                                            isCompulsory={isCompulsory}
                                            moduleTreeState={moduleTreeState}
                                            compact
                                            onToggle={() => {
                                                onToggleModule(option.id);
                                                setIsOpen(false); // Single-pick: close after selection
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
