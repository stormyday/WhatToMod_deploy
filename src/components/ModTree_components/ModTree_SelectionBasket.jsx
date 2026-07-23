import SelectionBasketButton from './ModTree_SelectionBasketButton';

export default function SelectedBasket({ selectedMods, selectedMajor, moduleDatabase, moduleTreeState, onToggleModule, onClearAll }) {
    return (
        <div
            style={{
                marginTop: '0px',
                padding: '10px',
                border: '1px solid rgba(0,0,0,0.1)',
                backgroundColor: '#F7F6F2',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 150px)',
                overflow: 'hidden',
                boxSizing: 'border-box',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, color: '#1a1a18', fontWeight: '600', fontSize: '12px' }}>
                        Selected Modules
                    </h3>
                    <p style={{ margin: '4px 0 0', color: '#4B5563', fontSize: '9px' }}>
                        Total MCs in Basket: {selectedMods.length * 4}
                    </p>
                </div>
                <button
                    onClick={onClearAll}
                    disabled={selectedMods.length === 0}
                    style={{
                        padding: '5px 8px',
                        borderRadius: '9px',
                        border: '1px solid rgba(0,0,0,0.12)',
                        backgroundColor: selectedMods.length === 0 ? '#F3F4F6' : '#1f2937',
                        color: selectedMods.length === 0 ? '#9ca3af' : '#ffffff',
                        cursor: selectedMods.length === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '9px',
                        fontWeight: '600'
                    }}
                >
                    Clear All
                </button>
            </div>
            <div style={{ flex: '0 0 auto' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', color: '#1D9E75', fontWeight: '500' }}>
                        <span style={{ width: '14px', height: '14px', backgroundColor: '#E1F5EE', display: 'inline-block', borderRadius: '4px', border: '1px solid #1D9E75' }} />
                        <span>Compulsory</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '8px', color: '#D85A30', fontWeight: '500' }}>
                        <span style={{ width: '14px', height: '14px', backgroundColor: '#FAECE7', display: 'inline-block', borderRadius: '4px', border: '1px solid #D85A30' }} />
                        <span>Optional</span>
                    </div>
                </div>
                </div>
            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', paddingRight: '2px', scrollbarWidth: 'thin' }}>
                {selectedMods.length === 0 ? (
                    <p style={{ color: '#888780', fontStyle: 'italic', fontSize: '8px' }}>
                        No modules selected yet.
                    </p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                        {selectedMods.map(id => {
                            const targetMod = moduleDatabase[id];
                            const isCompulsoryInBasket = targetMod?.compulsoryFor?.includes(selectedMajor);

                            return (
                                <div key={id} style={{ width: '100%' }}>
                                    <SelectionBasketButton
                                        moduleCode={id}
                                        isSelected={true}
                                        isCompulsory={isCompulsoryInBasket}
                                        onToggle={() => onToggleModule(id)}
                                        moduleTreeState={moduleTreeState}
                                        fullWidth
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
