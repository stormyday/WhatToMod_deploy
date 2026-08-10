import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSentiment } from '../../utils/api';
import { getPrereqConflictMessages, lookupModuleMetadata, lookupModulePrereq, normalizeModuleCode } from './modTreeModuleData';
import { useGradeRecommendation } from '../modRecco/gradeReccoState';
import { formatGradeRecommendation } from '../modRecco/gradeReccoFormat';

const sentimentCache = {};

export default function SelectionBasketButton({
    moduleCode,
    isSelected,
    onToggle,
    onRemove,
    moduleTreeState = null,
    fullWidth = false,
    availableModuleCodes = [],
    preclusionMessages = [],
    suppressPrereqWarnings = false,
}) {
    const normalizedModuleCode = useMemo(() => normalizeModuleCode(moduleCode), [moduleCode]);
    const gradeRecommendation = useGradeRecommendation(moduleCode);
    const [matchedModule, setMatchedModule] = useState(null);
    const [loadingModule, setLoadingModule] = useState(true);
    const [prereqInfo, setPrereqInfo] = useState(null);
    const [prereqResolvedCode, setPrereqResolvedCode] = useState(null);
    const [sentiment, setSentiment] = useState(null);
    const [isLoadingSentiment, setIsLoadingSentiment] = useState(false);
    const [notes, setNotes] = useState('');

    const handleDragStart = (event) => {
        event.dataTransfer.setData('text/plain', moduleCode);
        event.dataTransfer.effectAllowed = 'move';
    };

    useEffect(() => {
        let isMounted = true;
        lookupModuleMetadata(moduleCode).then((mod) => {
            if (isMounted) {
                setMatchedModule(mod);
                setLoadingModule(false);
            }
        });
        return () => { isMounted = false; };
    }, [moduleCode]);

    useEffect(() => {
        let isMounted = true;

        lookupModulePrereq(moduleCode).then((row) => {
            if (isMounted) {
                setPrereqInfo(row);
                setPrereqResolvedCode(normalizedModuleCode);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [moduleCode, normalizedModuleCode]);

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

    const missingPrereqCodes = useMemo(
        () => (suppressPrereqWarnings ? [] : getPrereqConflictMessages(prereqInfo, availableModuleCodes)),
        [availableModuleCodes, prereqInfo, suppressPrereqWarnings]
    );

    const hasPreclusionConflict = Array.isArray(preclusionMessages) && preclusionMessages.length > 0;
    const hasPrereqConflict = prereqResolvedCode === normalizedModuleCode && missingPrereqCodes.length > 0;
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
                    color: '#5F5E5A',
                    textAlign: 'left',
                    opacity: 0.7,
                    cursor: 'not-allowed',
                    fontSize: '11px'
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
                    color: '#5F5E5A',
                    textAlign: 'left',
                    cursor: 'not-allowed',
                    fontSize: '11px'
                }}
            >
                Unknown module
            </button>
        );
    }

    const bgColor = isSelected ? '#E1F5EE' : '#F7F6F2';
    const textColor = isSelected ? '#1D9E75' : '#5F5E5A';
    const borderColor = isSelected ? '#1D9E75' : 'rgba(0,0,0,0.1)';

    const renderSentimentRows = () => {
        const workload = sentiment?.workload;
        const difficulty = sentiment?.difficulty;

        const renderCompactAspect = (label, aspect) => {
            const pct = Math.round(Math.max(0, Math.min(1, aspect.score)) * 100);
            const barColor = label === 'Workload' ? '#D85A30' : '#185FA5';

            return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '600', color: '#42413F', gap: '4px' }}>
                        <span>{label}</span>
                        <span>{pct}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', borderRadius: '999px', backgroundColor: '#E8E6E3', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor }} />
                    </div>
                </div>
            );
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sentiment && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {renderCompactAspect('Workload', workload)}
                        {renderCompactAspect('Difficulty', difficulty)}
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '600', color: '#42413F' }}>
                        <span>Expected Grade</span>
                        <span>{formatGradeRecommendation(gradeRecommendation)}</span>
                    </div>
                </div>
            </div>
        );
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
                        fontSize: '11px',
                        fontWeight: '750',
                        color: textColor,
                        textDecoration: 'none',
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        lineHeight: 1.2
                    }}
                >
                    <u>{matchedModule.moduleCode?.toUpperCase?.() ?? moduleCode.toUpperCase()}</u>
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
                        fontSize: '11px',
                        padding: 0,
                        flexShrink: 0
                    }}
                >
                    X
                </button>
            </div>
            {isLoadingSentiment && (
                <div style={{ fontSize: '10px', color: '#7A766F' }}>
                    Loading review insights...
                </div>
            )}
            {renderSentimentRows()}
            {sentiment && (
                <div style={{ fontSize: '9px', color: '#7A766F' }}>
                    Based on {sentiment.reviewCount} reviews
                </div>
            )}
            {hasPrereqConflict && (
                <div style={{ fontSize: '11px', color: '#9A3412', lineHeight: 1.35 }}>
                    <span>Missing prerequisite{missingPrereqCodes.length > 1 ? 's' : ''} from earlier semesters: </span>
                    <strong>{missingPrereqCodes.join(', ')}</strong>
                </div>
            )}
            {hasPreclusionConflict && (
                <div style={{ fontSize: '9px', color: '#5F5E5A', lineHeight: 1.35 }}>
                    Precluded by: {preclusionMessages.join(', ')}
                </div>
            )}
            <div
                style={{
                    marginTop: '4px',
                    minHeight: '28px',
                }}
            >
                <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Notes..."
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.stopPropagation()}
                    style={{
                        width: '100%',
                        minHeight: '28px',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        background: 'transparent',
                        color: '#5F5E5A',
                        fontSize: '10px',
                        lineHeight: 1.4,
                        padding: 0,
                        margin: 0,
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                    }}
                />
            </div>
        </div>
    );
}
