import React, { useState } from 'react';
import PillarDropdown from './ModTree_PillarMod';

export default function Level4000Pathway({ nodeData, selectedMods, onToggleModule }) {
    const [activeTrack, setActiveTrack] = useState('A'); // Tracks track 'A' or 'B'

    return (
        <div style={{
            border: '2px solid #D97706',
            borderRadius: '12px',
            padding: '16px',
            backgroundColor: '#FFFDF9',
            maxWidth: '420px',
            margin: '0 auto',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#B45309', textAlign: 'center' }}>
                {nodeData.label}
            </h4>

            {/* Path Selection Interface */}
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '16px', gap: '10px' }}>
                <label style={{ 
                    flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '8px', 
                    cursor: 'pointer', textAlign: 'center', backgroundColor: activeTrack === 'A' ? '#FEF3C7' : '#FFF',
                    fontWeight: activeTrack === 'A' ? 'bold' : 'normal'
                }}>
                    <input 
                        type="radio" name="pathway4k" value="A" 
                        checked={activeTrack === 'A'} onChange={() => setActiveTrack('A')}
                        style={{ marginRight: '6px' }}
                    />
                    Option A (Coursework)
                </label>
                
                <label style={{ 
                    flex: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '8px', 
                    cursor: 'pointer', textAlign: 'center', backgroundColor: activeTrack === 'B' ? '#FEF3C7' : '#FFF',
                    fontWeight: activeTrack === 'B' ? 'bold' : 'normal'
                }}>
                    <input 
                        type="radio" name="pathway4k" value="B" 
                        checked={activeTrack === 'B'} onChange={() => setActiveTrack('B')}
                        style={{ marginRight: '6px' }}
                    />
                    Option B (Honours Project)
                </label>
            </div>

            {/* Conditional Pathway Render Zones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                {activeTrack === 'A' ? (
                    <>
                        <p style={{ fontSize: '12px', margin: '0', color: '#666', fontStyle: 'italic' }}>
                            Pass TWO courses (one from each basket below):
                        </p>
                        <PillarDropdown 
                            pillarModule={nodeData.optionA.basket1} 
                            selectedMods={selectedMods} 
                            onToggleModule={onToggleModule} 
                        />
                        <PillarDropdown 
                            pillarModule={nodeData.optionA.basket2} 
                            selectedMods={selectedMods} 
                            onToggleModule={onToggleModule} 
                        />
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: '12px', margin: '0', color: '#666', fontStyle: 'italic' }}>
                            Pass ONE Honours Project variant (8 Units):
                        </p>
                        <PillarDropdown 
                            pillarModule={nodeData.optionB} 
                            selectedMods={selectedMods} 
                            onToggleModule={onToggleModule} 
                        />
                    </>
                )}
            </div>
        </div>
    );
}