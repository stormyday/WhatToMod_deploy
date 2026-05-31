import React from 'react';
import ModuleButton from './ModTree_ModButton';
import PillarDropdown from './ModTree_PillarMod';
import Level4000Pathway from './ModTree_DSA4K';

export default function ModuleTree({ modulesByLvl, selectedMods, selectedMajor, onToggleModule }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'stretch' }}>
            {modulesByLvl.map((layer, layerIndex) => {
                const renderedGroups = new Set()

                return (
                    <div key={layerIndex} style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center', flex: 1 }}>
                        <div style={{ color: 'black', textAlign: 'center', fontWeight: 'bold' }}>Level {(layerIndex + 1)}000 Modules</div> 

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%' }}>
                            {layer.map((modInTree) => {
                                const groupId = modInTree.orGroupId

                                // Resolve if the module is compulsory for the active major dynamically
                                const isCompulsory = modInTree.compulsoryFor?.includes(selectedMajor)

                                if (modInTree.isPillar) {
                                    return (
                                        <div key={modInTree.id} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40px' }}>
                                            <PillarDropdown 
                                                pillarModule={modInTree}
                                                selectedMods={selectedMods}
                                                selectedMajor={selectedMajor}
                                                onToggleModule={onToggleModule}
                                            />
                                        </div>
                                    );
                                }

                                if (modInTree.isSingleModulePillar) {
                                    const isSelected = selectedMods.includes(modInTree.id);
                                    return (
                                        <div key={modInTree.id} style={{
                                            border: '2px solid #4A90E2',
                                            borderRadius: '8px',
                                            padding: '8px',
                                            backgroundColor: isSelected ? '#E6F4FF' : '#FAFAFA',
                                            textAlign: 'center',
                                            width: '180px'
                                        }}>
                                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#4A90E2', marginBottom: '4px', textTransform: 'uppercase' }}>
                                                {modInTree.pillarLabel} Pillar
                                            </div>
                                            <ModuleButton 
                                                moduleCode={modInTree.id} 
                                                isSelected={isSelected} 
                                                isCompulsory={modInTree.compulsoryFor?.includes(selectedMajor)}
                                                onToggle={() => onToggleModule(modInTree.id)} 
                                            />
                                        </div>
                                    );
                                }

                                if (modInTree.isLevel4000Pathway) {
                                    return (
                                        <div key={modInTree.id} style={{ gridColumn: '1 / -1', margin: '15px 0', width: '100%' }}>
                                            <Level4000Pathway 
                                                nodeData={modInTree}
                                                selectedMods={selectedMods}
                                                onToggleModule={onToggleModule}
                                            />
                                        </div>
                                    );
                                }

                                if (groupId) {
                                    if (renderedGroups.has(groupId)) return null
                                    renderedGroups.add(groupId)

                                    const groupModules = layer.filter(m => m.orGroupId === groupId)

                                    return (
                                        <div key={groupId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', paddingLeft: '65px', minHeight: '110px' }}>
                                            <div style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', marginRight: '6px' }}>One of</span>
                                                <div style={{ width: '12px', height: '75px', border: '2px solid #555', borderRight: 'none', borderRadius: '6px 0 0 6px' }} />
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
                                                {groupModules.map((groupMod) => {
                                                    const isSelected = selectedMods.includes(groupMod.id)
                                                    const isGroupModCompulsory = groupMod.compulsoryFor?.includes(selectedMajor)
                                                    return (
                                                        <ModuleButton 
                                                            key={groupMod.id}
                                                            moduleCode={groupMod.id} 
                                                            isSelected={isSelected} 
                                                            isCompulsory={isGroupModCompulsory}
                                                            onToggle={() => onToggleModule(groupMod.id)} 
                                                        />
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                }

                                const isSelected = selectedMods.includes(modInTree.id)
                                return (
                                    <div key={modInTree.id} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40px' }}>
                                        <ModuleButton 
                                            moduleCode={modInTree.id} 
                                            isSelected={isSelected} 
                                            isCompulsory={isCompulsory}
                                            onToggle={() => onToggleModule(modInTree.id)} 
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}