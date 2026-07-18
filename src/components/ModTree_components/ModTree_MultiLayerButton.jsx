import { useEffect, useMemo, useState } from 'react';
import PillarDropdown from './ModTree_PillarMod';
import ModuleButton from './ModTree_ModButton';
import {
    analyzeLevel4000Pathway,
    clearLevel4000ActiveTracks,
    getLevel4000ActiveTracks,
    setLevel4000ActiveTracks,
} from './ModTree_Level4000Traversal';

function buildPillarDropdownShape(node) {
    return {
        ...node.rawNode,
        label: node.label,
        options: Array.isArray(node.childrenGroup?.nodes)
            ? node.childrenGroup.nodes.map((child) => ({
                id: child.rawNode?.id ?? child.pathKey,
                label: child.label,
                description: child.rawNode?.description ?? child.rawNode?.label ?? '',
            }))
            : [],
    };
}

function buildModuleButtonShape(node) {
    return {
        id: node.rawNode?.id,
        label: node.label,
        description: node.rawNode?.description ?? '',
        compulsoryFor: node.rawNode?.compulsoryFor ?? [],
    };
}

function AnalysisMessage({ title, body, tone = 'error' }) {
    const isError = tone === 'error';

    return (
        <div
            style={{
                border: `1px solid ${isError ? 'rgba(216, 90, 48, 0.22)' : 'rgba(95, 94, 90, 0.18)'}`,
                borderRadius: '10px',
                padding: '10px 12px',
                backgroundColor: isError ? '#FAECE7' : '#F7F6F2',
                color: isError ? '#D85A30' : '#5F5E5A',
                fontSize: '12px',
                lineHeight: 1.45,
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
            }}
        >
            <div style={{ fontWeight: '700', marginBottom: '4px' }}>{title}</div>
            <div>{body}</div>
        </div>
    );
}

function SectionFlag({ text = 'Invalid data' }) {
    return (
        <span
            style={{
                marginLeft: '8px',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: '#FAECE7',
                color: '#D85A30',
                border: '1px solid rgba(216, 90, 48, 0.2)',
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.02em',
                whiteSpace: 'nowrap',
            }}
        >
            {text}
        </span>
    );
}

function PathwayTabs({ analysis, moduleId, setActiveTracks, renderNode }) {
    const activeIndex = analysis.autoCollapsed ? 0 : analysis.activeIndex ?? 0;
    const activeNode = analysis.nodes[activeIndex];

    if (!activeNode) {
        return (
            <AnalysisMessage
                title="No data available"
                body="This pathway does not contain a usable branch."
                tone="error"
            />
        );
    }

    if (analysis.autoCollapsed) {
        return renderNode(activeNode);
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    width: '100%',
                }}
            >
                {analysis.nodes.map((node, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <button
                            key={node.pathKey}
                            type="button"
                            onClick={() => {
                                setActiveTracks((current) => {
                                    const next = { ...current, [analysis.pathKey]: index };
                                    setLevel4000ActiveTracks(moduleId, next);
                                    return next;
                                });
                            }}
                            style={{
                                flex: '1 1 120px',
                                minWidth: '120px',
                                padding: '8px 10px',
                                borderRadius: '10px',
                                border: `2px solid ${isActive ? '#185FA5' : 'rgba(0,0,0,0.1)'}`,
                                backgroundColor: isActive ? '#E6F1FB' : '#F7F6F2',
                                color: isActive ? '#185FA5' : '#5F5E5A',
                                fontWeight: isActive ? '700' : '600',
                                fontSize: '12px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.15s ease-in-out',
                                boxSizing: 'border-box',
                            }}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <span>{node.label}</span>
                                {node.malformed ? <SectionFlag text="Flagged" /> : null}
                            </span>
                        </button>
                    );
                })}
            </div>

            {renderNode(activeNode)}
        </div>
    );
}

function renderModuleNode(node, selectedMods, selectedMajor, moduleTreeState, onToggleModule) {
    const moduleShape = buildModuleButtonShape(node);

    if (!moduleShape.id) {
        return (
            <AnalysisMessage
                key={node.pathKey}
                title="Malformed module node"
                body="This module node is missing a valid module id."
                tone="error"
            />
        );
    }

    const isSelected = Array.isArray(selectedMods) && selectedMods.includes(moduleShape.id);
    const isCompulsory = Boolean(moduleShape.compulsoryFor?.includes(selectedMajor));

    return (
        <div
            key={node.pathKey}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                alignItems: 'stretch',
                width: '100%',
            }}
        >
            <ModuleButton
                moduleCode={moduleShape.id}
                isSelected={isSelected}
                isCompulsory={isCompulsory}
                moduleTreeState={moduleTreeState}
                compact
                fullWidth
                onToggle={() => onToggleModule(moduleShape.id)}
            />
            {node.malformed ? (
                <AnalysisMessage
                    title="Malformed module node"
                    body="This module node contains more than one type key."
                    tone="error"
                />
            ) : null}
        </div>
    );
}

function renderPillarNode(node, selectedMods, selectedMajor, moduleTreeState, onToggleModule) {
    const pillarShape = buildPillarDropdownShape(node);
    const hasValidChildren = Array.isArray(node.childrenGroup?.nodes) && node.childrenGroup.nodes.length > 0;

    if (!hasValidChildren) {
        const emptyMessage = node.childrenGroup?.kind === 'empty'
            ? node.childrenGroup.message
            : 'No data available for this requirement.';

        return (
            <AnalysisMessage
                key={node.pathKey}
                title="No data available"
                body={emptyMessage}
                tone="error"
            />
        );
    }

    return (
        <div
            key={node.pathKey}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'center',
                width: '100%',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    gap: '6px',
                }}
            >
                <PillarDropdown
                    pillarModule={pillarShape}
                    selectedMods={selectedMods}
                    selectedMajor={selectedMajor}
                    moduleTreeState={moduleTreeState}
                    onToggleModule={onToggleModule}
                />
                {node.malformed ? <SectionFlag text="Flagged" /> : null}
            </div>
            {node.childrenGroup?.hasError ? (
                <AnalysisMessage
                    title="Invalid pillar data"
                    body="This pillar contains malformed or unsupported child data."
                    tone="error"
                />
            ) : null}
        </div>
    );
}

function renderGroupNode(analysis, moduleId, selectedMods, selectedMajor, moduleTreeState, onToggleModule, setActiveTracks, renderNode) {
    if (!analysis || analysis.kind !== 'group') {
        if (analysis?.kind === 'empty') {
            return (
                <AnalysisMessage
                    title="No data available"
                    body={analysis.message ?? 'This requirement does not have any child nodes.'}
                />
            );
        }

        if (analysis?.kind === 'invalid') {
            return (
                <AnalysisMessage
                    title="Invalid pathway data"
                    body={analysis.message ?? 'This pathway cannot be rendered safely.'}
                />
            );
        }

        if (analysis?.kind === 'mixed') {
            return (
                <AnalysisMessage
                    title="Invalid pathway data"
                    body={analysis.message ?? 'This subtree mixes pathway, pillar, and module nodes.'}
                />
            );
        }

        return (
            <AnalysisMessage
                title="Invalid pathway data"
                body="Unable to render this subtree."
            />
        );
    }

    if (analysis.groupType === 'pathway') {
        return (
            <PathwayTabs
                analysis={analysis}
                moduleId={moduleId}
                setActiveTracks={setActiveTracks}
                renderNode={renderNode}
            />
        );
    }

    if (analysis.groupType === 'pillar') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
                {analysis.nodes.map((node) => renderPillarNode(node, selectedMods, selectedMajor, moduleTreeState, onToggleModule))}
            </div>
        );
    }

    if (analysis.groupType === 'module') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'center' }}>
                {analysis.nodes.map((node) => renderModuleNode(node, selectedMods, selectedMajor, moduleTreeState, onToggleModule))}
            </div>
        );
    }

    return (
        <AnalysisMessage
            title="Invalid pathway data"
            body="This subtree could not be classified."
        />
    );
}

export default function Level4000Pathway({ nodeData, selectedMods, selectedMajor, moduleTreeState, onToggleModule }) {
    const moduleId = nodeData?.id ?? null;
    const [activeTracks, setActiveTracks] = useState(() => getLevel4000ActiveTracks(moduleId));

    useEffect(() => () => {
        clearLevel4000ActiveTracks(moduleId);
    }, [moduleId]);

    useEffect(() => {
        setLevel4000ActiveTracks(moduleId, activeTracks);
    }, [moduleId, activeTracks]);

    const analysis = useMemo(
        () => analyzeLevel4000Pathway(nodeData, selectedMods, activeTracks),
        [nodeData, selectedMods, activeTracks]
    );

    const rootTitle = nodeData?.label ?? nodeData?.moduleName ?? 'Level 4000 Requirement';
    const showInvalid = analysis.kind === 'invalid';
    const showEmpty = analysis.kind === 'empty';
    const showMixed = analysis.kind === 'mixed';
    const hasVisibleIssue = analysis.hasError || showInvalid || showEmpty || showMixed;

    const renderNode = (nodeAnalysis) => {
        if (!nodeAnalysis) {
            return (
                <AnalysisMessage
                    title="No data available"
                    body="This branch has no renderable content."
                />
            );
        }

        if (nodeAnalysis.type === 'module') {
            return renderModuleNode(nodeAnalysis, selectedMods, selectedMajor, moduleTreeState, onToggleModule);
        }

        if (nodeAnalysis.type === 'pillar') {
            return renderPillarNode(nodeAnalysis, selectedMods, selectedMajor, moduleTreeState, onToggleModule);
        }

        if (nodeAnalysis.type === 'pathway') {
            return (
                <div
                    key={nodeAnalysis.pathKey}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        width: '100%',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            borderRadius: '10px',
                            backgroundColor: '#E6F1FB',
                            color: '#185FA5',
                            fontWeight: '700',
                            fontSize: '12px',
                            border: '1px solid rgba(24, 95, 165, 0.16)',
                        }}
                    >
                        <span>{nodeAnalysis.label}</span>
                        {nodeAnalysis.malformed ? <SectionFlag text="Flagged" /> : null}
                    </div>

                    {nodeAnalysis.childrenGroup?.kind === 'group' || nodeAnalysis.childrenGroup?.kind === 'mixed'
                        ? renderGroupNode(nodeAnalysis.childrenGroup, moduleId, selectedMods, selectedMajor, moduleTreeState, onToggleModule, setActiveTracks, renderNode)
                        : (
                            <AnalysisMessage
                                title="No data available"
                                body={nodeAnalysis.childrenGroup?.message ?? 'This pathway does not contain usable child data.'}
                            />
                        )}
                </div>
            );
        }

        return (
            <AnalysisMessage
                title="Invalid pathway data"
                body="This node type cannot be rendered."
            />
        );
    };

    if (showInvalid || showEmpty || showMixed) {
        return (
            <div
                style={{
                    border: '1px solid rgba(216, 90, 48, 0.16)',
                    borderRadius: '14px',
                    padding: '12px',
                    backgroundColor: '#ffffff',
                    maxWidth: '360px',
                    margin: '0 auto',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{ color: '#185FA5', textAlign: 'center', fontWeight: '700', marginBottom: '10px' }}>
                    {rootTitle}
                </div>
                <AnalysisMessage
                    title={
                        showInvalid
                            ? 'Invalid pathway data'
                            : showEmpty
                                ? 'No data available'
                                : 'Invalid pathway data'
                    }
                    body={analysis.message ?? 'This pathway cannot be rendered safely.'}
                />
            </div>
        );
    }

    return (
        <div
            style={{
                border: `1px solid ${hasVisibleIssue ? 'rgba(216, 90, 48, 0.16)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: '14px',
                padding: '12px',
                backgroundColor: '#ffffff',
                maxWidth: '360px',
                margin: '0 auto',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                boxSizing: 'border-box',
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
                    marginBottom: '10px',
                    gap: '6px',
                    flexWrap: 'wrap',
                }}
            >
                <span>{rootTitle}</span>
                {analysis.hasError ? <SectionFlag text="Flagged" /> : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', width: '100%' }}>
                {renderGroupNode(analysis, moduleId, selectedMods, selectedMajor, moduleTreeState, onToggleModule, setActiveTracks, renderNode)}
            </div>
        </div>
    );
}
