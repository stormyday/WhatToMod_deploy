import React from 'react';
import ModuleButton from './ModTree_ModButton';

export default function SelectedBasket({ selectedMods, selectedMajor, moduleDatabase, onToggleModule }) {
    return (
        <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', backgroundColor: '#F6EDDC'}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Selected Modules ({selectedMods.length})</h3>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#333' }}>
                        <span style={{ width: '14px', height: '14px', backgroundColor: '#C6F2BF', display: 'inline-block', borderRadius: '3px', border: '1px solid #999' }} />
                        <span>- Compulsory</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#333' }}>
                        <span style={{ width: '14px', height: '14px', backgroundColor: '#fac9a5', display: 'inline-block', borderRadius: '3px', border: '1px solid #999' }} />
                        <span>- Optional</span>
                    </div>
                </div>
            </div>
            {selectedMods.length === 0 ? (
                <p style={{ color: 'gray', fontStyle: 'italic' }}>No modules selected yet.</p>
            ) : (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {selectedMods.map(id => {
                        const targetMod = moduleDatabase[id];
                        const isCompulsoryInBasket = targetMod?.compulsoryFor?.includes(selectedMajor);

                        return (
                            <div key={id}>
                                <ModuleButton 
                                    moduleCode={id} 
                                    isSelected={true} 
                                    isCompulsory={isCompulsoryInBasket}
                                    onToggle={() => onToggleModule(id)} 
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}