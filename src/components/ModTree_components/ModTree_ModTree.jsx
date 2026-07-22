import { useSyncExternalStore } from 'react';
import ModuleButton from './ModTree_ModButton';
import PillarDropdown from './ModTree_PillarMod';
import RequirementGroup from './ModTree_RequirementGroup';
import Level4000Pathway from './ModTree_MultiLayerButton';
import {
    analyzeLevel4000Pathway,
    getLevel4000ActiveTracksVersion,
    subscribeLevel4000ActiveTracks,
} from './ModTree_Level4000Traversal';

function satisfiesLevel4000Pathway(moduleConfig, selectedMods) {
    return analyzeLevel4000Pathway(moduleConfig, selectedMods).complete;
}

function isModuleSelected(moduleId, selectedMods) {
    return selectedMods.includes(moduleId);
}

function getLayerCompletionState(layer, selectedMods) {
    const orGroupIds = [...new Set(layer.map(mod => mod.orGroupId).filter(Boolean))];
    const requirements = [];

    orGroupIds.forEach((groupId) => {
        const groupModules = layer.filter(mod => mod.orGroupId === groupId);
        const anySelected = groupModules.some((groupMod) =>
            groupMod.isPillar
                ? groupMod.options?.some(option => isModuleSelected(option.id, selectedMods))
                : isModuleSelected(groupMod.id, selectedMods)
        );
        requirements.push(anySelected);
    });

    layer.filter(mod => !mod.orGroupId).forEach((mod) => {
        if (mod.isPillar) {
            requirements.push(Boolean(mod.options?.some(option => isModuleSelected(option.id, selectedMods))));
        } else if (mod.isRequirementGroup) {
            const pillars = Array.isArray(mod.RequirementsPillar) ? mod.RequirementsPillar : [];
            requirements.push(
                pillars.length > 0
                && pillars.every((pillar) => Array.isArray(pillar.options)
                    && pillar.options.some((option) => isModuleSelected(option.id, selectedMods)))
            );
        } else if (mod.isSingleModulePillar) {
            requirements.push(isModuleSelected(mod.id, selectedMods));
        } else if (mod.isLevel4000Pathway) {
            requirements.push(satisfiesLevel4000Pathway(mod, selectedMods));
        } else {
            requirements.push(isModuleSelected(mod.id, selectedMods));
        }
    });

    return {
        layerComplete: requirements.length > 0 && requirements.every(Boolean),
    };
}

export default function ModuleTree({
    modulesByLvl,
    selectedMods,
    selectedMajor,
    moduleTreeState,
    onToggleModule,
    customModules = [],
    onRemoveCustomModule,
}) {
    const level4000ActiveTracksVersion = useSyncExternalStore(
        subscribeLevel4000ActiveTracks,
        getLevel4000ActiveTracksVersion,
        getLevel4000ActiveTracksVersion
    );

    void level4000ActiveTracksVersion;

    const columnStyle = {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        alignItems: 'center',
        flex: '0 0 205px',
        minWidth: '205px',
        padding: '8px 4px',
        borderRadius: '10px',
        transition: 'background-color 0.15s ease',
        boxSizing: 'border-box',
    };

    const columnTitleStyle = {
        color: '#1a1a18',
        textAlign: 'center',
        fontWeight: '600',
        fontSize: '12px',
    };

    const renderCustomColumn = () => (
        <div
            style={{
                ...columnStyle,
                backgroundColor: 'transparent',
            }}
        >
            <div style={columnTitleStyle}>
                User Added Modules
            </div>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    width: '100%',
                }}
            >
                {customModules.length === 0 ? (
                    <div
                        style={{
                            border: '1px dashed rgba(0,0,0,0.12)',
                            borderRadius: '10px',
                            padding: '12px 10px',
                            backgroundColor: '#f9fafb',
                            color: '#6b7280',
                            fontSize: '12px',
                            textAlign: 'center',
                            lineHeight: 1.45,
                            width: '100%',
                        }}
                    >
                        Search above to add modules here.
                    </div>
                ) : (
                    customModules.map((customModule) => {
                        const moduleCode = customModule.moduleCode;
                        const isSelected = selectedMods.includes(moduleCode);

                        return (
                            <div key={moduleCode} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '34px', width: '100%' }}>
                                <ModuleButton
                                    moduleCode={moduleCode}
                                    isSelected={isSelected}
                                    isCompulsory={false}
                                    moduleTreeState={moduleTreeState}
                                    compact
                                    onToggle={() => onToggleModule(moduleCode)}
                                />
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'stretch', gap: '6px', width: '100%', overflowX: 'auto', overflowY: 'hidden', minWidth: '0' }}>
            {modulesByLvl.map((layer, layerIndex) => {
                const renderedGroups = new Set();
                const { layerComplete } = getLayerCompletionState(layer, selectedMods);

                return (
                    <div
                        key={layerIndex}
                        style={{
                            ...columnStyle,
                            backgroundColor: layerComplete ? '#E1F5EE' : 'transparent',
                        }}
                    >
                        <div style={columnTitleStyle}>
                            Level {(layerIndex + 1)}000 Modules
                        </div>

                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '12px',
                            alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%'
                        }}>
                            {layer.map((modInTree) => {
                                const groupId = modInTree.orGroupId;
                                // Compute once, reuse across all branches below
                                const isCompulsory = modInTree.compulsoryFor?.includes(selectedMajor);

                                // ── isPillar ──────────────────────────────────────────
                                if (modInTree.isPillar) {
                                    return (
                                        <div key={modInTree.id} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '34px' }}>
                                            <PillarDropdown
                                                pillarModule={modInTree}
                                                selectedMods={selectedMods}
                                                selectedMajor={selectedMajor}
                                                moduleTreeState={moduleTreeState}
                                                onToggleModule={onToggleModule}
                                            />
                                        </div>
                                    );
                                }

                                // ── isRequirementGroup ───────────────────────────────
                                if (modInTree.isRequirementGroup) {
                                    return (
                                        <div key={modInTree.id} style={{ width: '100%' }}>
                                            <RequirementGroup
                                                nodeData={modInTree}
                                                selectedMods={selectedMods}
                                                selectedMajor={selectedMajor}
                                                moduleTreeState={moduleTreeState}
                                                onToggleModule={onToggleModule}
                                            />
                                        </div>
                                    );
                                }

                                // ── isSingleModulePillar ──────────────────────────────
                                if (modInTree.isSingleModulePillar) {
                                    const isSelected = selectedMods.includes(modInTree.id);
                                    return (
                                        <div key={modInTree.id} style={{
                                            border: '1px solid rgba(0,0,0,0.1)',
                                            borderRadius: '10px', padding: '10px',
                                            backgroundColor: '#ffffff', textAlign: 'center',
                                            width: '150px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                                        }}>
                                            <div style={{ fontSize: '10px', fontWeight: '600', color: '#185FA5', marginBottom: '6px', textTransform: 'uppercase' }}>
                                                {modInTree.pillarLabel} Pillar
                                            </div>
                                            <ModuleButton
                                                moduleCode={modInTree.id}
                                                isSelected={isSelected}
                                                isCompulsory={isCompulsory}
                                                moduleTreeState={moduleTreeState}
                                                compact
                                                onToggle={() => onToggleModule(modInTree.id)}
                                            />
                                        </div>
                                    );
                                }

                                // ── isLevel4000Pathway ────────────────────────────────
                                if (modInTree.isLevel4000Pathway) {
                                    return (
                                        <div key={modInTree.id} style={{ width: '100%' }}>
                                            <Level4000Pathway
                                                nodeData={modInTree}
                                                selectedMods={selectedMods}
                                                selectedMajor={selectedMajor}
                                                moduleTreeState={moduleTreeState}
                                                onToggleModule={onToggleModule}
                                            />
                                        </div>
                                    );
                                }

                                // ── orGroup (plain modules) ───────────────────────────
                                if (groupId) {
                                    if (renderedGroups.has(groupId)) return null;
                                    renderedGroups.add(groupId);

                                    const groupModules = layer.filter(m => m.orGroupId === groupId);

                                    return (
                                        <div key={groupId} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            position: 'relative', paddingLeft: '50px', minHeight: '90px'
                                        }}>
                                            <div style={{ position: 'absolute', left: 0, display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontSize: '10px', fontWeight: '600', color: '#5F5E5A', marginRight: '6px' }}>One of</span>
                                                <div style={{ width: '10px', height: '60px', border: '2px solid rgba(0,0,0,0.1)', borderRight: 'none', borderRadius: '6px 0 0 6px' }} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                                {groupModules.map((groupMod) => (
                                                    <ModuleButton
                                                        key={groupMod.id}
                                                        moduleCode={groupMod.id}
                                                        isSelected={selectedMods.includes(groupMod.id)}
                                                        isCompulsory={groupMod.compulsoryFor?.includes(selectedMajor)}
                                                        moduleTreeState={moduleTreeState}
                                                        compact
                                                        onToggle={() => onToggleModule(groupMod.id)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                // ── Plain module ──────────────────────────────────────
                                return (
                                    <div key={modInTree.id} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '34px' }}>
                                        <ModuleButton
                                            moduleCode={modInTree.id}
                                            isSelected={selectedMods.includes(modInTree.id)}
                                            isCompulsory={isCompulsory}
                                            moduleTreeState={moduleTreeState}
                                            compact
                                            onToggle={() => onToggleModule(modInTree.id)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {renderCustomColumn()}
        </div>
    );
}
