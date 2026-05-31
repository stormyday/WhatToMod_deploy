import React, { useState } from 'react';
import ModuleButton from './ModTree_ModButton';

export default function PillarDropdown({ pillarModule, selectedMods, onToggleModule }) {
    const [isOpen, setIsOpen] = useState(false);

    // Check if any of the sub-options inside this pillar are currently selected
    const selectedOption = pillarModule.options.find(opt => selectedMods.includes(opt.id));

    return (
        <div style={{ 
            border: '1px dashed #222324', 
            borderRadius: '8px', 
            padding: '10px', 
            backgroundColor: '#FFFBF2',
            width: '180px',
            textAlign: 'center'
        }}>
            {/* Main Pillar Trigger Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedOption ? '#C6F2BF' : '#E0DBCF',
                    fontWeight: 'bold',
                    border: '1px solid #222324',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                {/* Show the selected module name if one is picked, otherwise show the general pillar label */}
                <span>{selectedOption ? selectedOption.label : pillarModule.label}</span>
                <span>{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Expanded Content Dropdown */}
            {isOpen && (
                <div style={{ 
                    marginTop: '10px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px',
                    padding: '5px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '6px',
                    border: '1px solid #cccccc'
                }}>
                    <p style={{ fontSize: '11px', margin: '0 0 5px 0', color: '#666' }}>Select 1 Option:</p>
                    {pillarModule.options.map((option) => {
                        const isSelected = selectedMods.includes(option.id);
                        return (
                            <ModuleButton 
                                key={option.id}
                                moduleCode={option.id}
                                isSelected={isSelected}
                                isCompulsory={pillarModule.compulsoryFor?.includes('DSA-Major')} // Inherits pillar status
                                onToggle={() => onToggleModule(option.id)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}