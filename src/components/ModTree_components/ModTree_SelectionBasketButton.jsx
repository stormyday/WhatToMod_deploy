import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSentiment } from '../../utils/api';
import { supabase } from '../../supabaseClient';

const sentimentCache = {};
const moduleLookupCache = {};

function rowToModule(row) {
    return {
        id: row.id,
        label: row.label,
        level: row.level,
        description: row.description,
        majors: row.majors ?? [],
        compulsoryFor: row.compulsory_for ?? [],
        orGroupId: row.or_group_id ?? undefined,
        isPillar: row.is_pillar,
        isSingleModulePillar: row.is_single_module_pillar,
        pillarLabel: row.pillar_label ?? undefined,
        isLevel4000Pathway: row.is_level4000_pathway,
        options: row.options ?? undefined,
    };
}

function collectNestedModules(node, collected = []) {
    if (!node || typeof node !== 'object') {
        return collected;
    }

    if (typeof node.id === 'string' && node.id) {
        collected.push(node);
    }

    if (Array.isArray(node.children)) {
        node.children.forEach((child) => collectNestedModules(child, collected));
    }

    return collected;
}

async function lookupModule(moduleCode) {
    const key = moduleCode.toLowerCase();
    if (moduleLookupCache[key]) return moduleLookupCache[key];

    const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('id', key)
        .single();

    if (error || !data) {
        const { data: all } = await supabase.from('modules').select('id,options');
        let found = null;
        for (const row of all ?? []) {
            if (row.options) {
                const match = collectNestedModules({ children: row.options }).find((o) => o.id === key);
                if (match) {
                    found = match;
                    break;
                }
            }
        }
        moduleLookupCache[key] = found ?? null;
        return moduleLookupCache[key];
    }

    const mod = rowToModule(data);
    moduleLookupCache[key] = mod;
    return mod;
}

export default function SelectionBasketButton({ moduleCode, isSelected, isCompulsory, onToggle, onRemove, moduleTreeState = null, fullWidth = false }) {
    const [matchedModule, setMatchedModule] = useState(null);
    const [loadingModule, setLoadingModule] = useState(true);
    const [sentiment, setSentiment] = useState(null);
    const [isLoadingSentiment, setIsLoadingSentiment] = useState(false);

    const handleDragStart = (event) => {
        event.dataTransfer.setData('text/plain', moduleCode);
        event.dataTransfer.effectAllowed = 'move';
    };

    useEffect(() => {
        let isMounted = true;
        lookupModule(moduleCode).then((mod) => {
            if (isMounted) {
                setMatchedModule(mod);
                setLoadingModule(false);
            }
        });
        return () => { isMounted = false; };
    }, [moduleCode]);

    useEffect(() => {
        if (sentiment) return;

        const cacheKey = moduleCode.toUpperCase();
        const cached = sentimentCache[cacheKey];
        if (cached) {
            const frame = window.requestAnimationFrame(() => setSentiment(cached));
            return () => window.cancelAnimationFrame(frame);
        }

        let isMounted = true;
        const loadingFrame = window.requestAnimationFrame(() => {
            if (isMounted) {
                setIsLoadingSentiment(true);
            }
        });

        fetchSentiment(cacheKey)
            .then((data) => {
                if (isMounted) {
                    sentimentCache[cacheKey] = data;
                    setSentiment(data);
                }
            })
            .finally(() => { if (isMounted) setIsLoadingSentiment(false); });

        return () => {
            isMounted = false;
            window.cancelAnimationFrame(loadingFrame);
        };
    }, [moduleCode, sentiment]);

    if (loadingModule) {
        return (
            <button
                disabled
                style={{
                    width: fullWidth ? '100%' : 'auto',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    backgroundColor: '#F7F6F2',
                    color: '#6B7280',
                    textAlign: 'left',
                    opacity: 0.7,
                    cursor: 'not-allowed',
                    fontSize: '9px'
                }}
            >
                Loading module…
            </button>
        );
    }

    if (!matchedModule) {
        return (
            <button
                disabled
                style={{
                    width: fullWidth ? '100%' : 'auto',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.08)',
                    backgroundColor: '#F7F6F2',
                    color: '#9CA3AF',
                    textAlign: 'left',
                    cursor: 'not-allowed',
                    fontSize: '9px'
                }}
            >
                Unknown module
            </button>
        );
    }

    const bgColor = isCompulsory ? '#E1F5EE' : '#FAECE7';
    const textColor = isCompulsory ? '#1D9E75' : '#D85A30';
    const borderColor = isSelected
        ? (isCompulsory ? '#1D9E75' : '#D85A30')
        : 'rgba(0,0,0,0.1)';

    const renderSentimentRows = () => {
        if (!sentiment) return null;

        const entries = [
            ['Workload', sentiment.workload],
            ['Difficulty', sentiment.difficulty],
            ['Expected Grade', sentiment.expectedGrade],
        ];

        return entries.map(([label, aspect]) => {
            const pct = Math.round(Math.max(0, Math.min(1, aspect.score)) * 100);
            const barColor = label === 'Workload' ? '#D85A30' : label === 'Difficulty' ? '#185FA5' : '#1D9E75';
            return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', fontWeight: '600', color: '#42413F' }}>
                        <span>{label}</span>
                        <span>{pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '999px', backgroundColor: '#E8E6E3', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor }} />
                    </div>
                </div>
            );
        });
    };

const linkState = moduleTreeState ? {
        from: '/moduleTree',
        moduleTreeState: {
            ...moduleTreeState,
            scrollPosition: typeof window !== 'undefined' ? window.scrollY : 0,
        },
    } : undefined;

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            style={{
                width: fullWidth ? '100%' : 'auto',
                padding: '8px 9px',
                borderRadius: '12px',
                border: `2px solid ${borderColor}`,
                backgroundColor: bgColor,
                color: textColor,
                cursor: 'grab',
                textAlign: 'left',
                transition: 'all 0.15s ease-in-out',
                boxShadow: isSelected ? '0 8px 24px rgba(29, 158, 117, 0.08)' : 'none',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <Link
                    to={`/insights/${encodeURIComponent(moduleCode)}`}
                    state={linkState}
                    style={{
                        fontSize: '9px',
                        fontWeight: '750',
                        color: '#0000FF',
                        textDecoration: 'none',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        lineHeight: 1.2
                    }}
                >
                    <u>{matchedModule.label}</u>
                </Link>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        if (onRemove) {
                            onRemove();
                        } else {
                            onToggle?.();
                        }
                    }}
                    style={{
                        border: 'none',
                        background: 'rgba(255,255,255,0.9)',
                        color: '#6b7280',
                        width: '18px',
                        height: '18px',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        display: 'grid',
                        placeItems: 'center normal',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                        fontSize: '9px',
                        padding: 0,
                        flexShrink: 0
                    }}
                >
                    X
                </button>
            </div>
            {matchedModule.description && (
                <div style={{ fontSize: '8px', color: '#5F5E5A', lineHeight: '1.25', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {matchedModule.description}
                </div>
            )}
            {isLoadingSentiment && (
                <div style={{ fontSize: '8px', color: '#7A766F' }}>
                    Loading review insights...
                </div>
            )}
            {renderSentimentRows()}
            {sentiment && (
                <div style={{ fontSize: '7px', color: '#7A766F' }}>
                    Based on {sentiment.reviewCount} reviews
                </div>
            )}
        </div>
    );
}
