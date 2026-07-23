import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSentiment } from '../../utils/api';
import { getPrereqConflictMessages, lookupModuleMetadata, lookupModulePrereq, normalizeModuleCode } from './modTreeModuleData';

const sentimentCache = {};

export default function SelectionBasketButton({
    moduleCode,
    isSelected,
    isCompulsory,
    onToggle,
    onRemove,
    moduleTreeState = null,
    fullWidth = false,
    availableModuleCodes = [],
    preclusionMessages = [],
    suppressPrereqWarnings = false,
}) {
    const normalizedModuleCode = useMemo(() => normalizeModuleCode(moduleCode), [moduleCode]);
    const [matchedModule, setMatchedModule] = useState(null);
    const [loadingModule, setLoadingModule] = useState(true);
    const [prereqInfo, setPrereqInfo] = useState(null);
    const [prereqResolvedCode, setPrereqResolvedCode] = useState(null);
    const [sentiment, setSentiment] = useState(null);
    const [isLoadingSentiment, setIsLoadingSentiment] = useState(false);

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
    const hasWarning = hasPreclusionConflict || hasPrereqConflict;

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

    const bgColor = hasWarning ? '#FFF1E5' : isCompulsory ? '#E1F5EE' : '#FAECE7';
    const textColor = hasWarning ? '#C2410C' : isCompulsory ? '#1D9E75' : '#D85A30';
    const borderColor = isSelected
        ? (hasWarning ? '#EA580C' : isCompulsory ? '#1D9E75' : '#D85A30')
        : 'rgba(0,0,0,0.1)';

    const renderSentimentRows = () => {
        if (!sentiment) return null;

        const entries = [
            ['Workload', sentiment.workload],
            ['Difficulty', sentiment.difficulty],
            ['Expected Grade', sentiment.expectedGrade],
        ];

        return entries.map(([label, aspect]) => {
            const isExpectedGrade = label === 'Expected Grade';
            const pct = Math.round(Math.max(0, Math.min(1, aspect.score)) * 100);
            const barColor = label === 'Workload' ? '#D85A30' : '#185FA5';

            return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '8px', fontWeight: '600', color: '#42413F' }}>
                        <span>{label}</span>
                        {isExpectedGrade ? (
                            <span>{aspect.level}</span>
                        ) : (
                            <span>{pct}%</span>
                        )}
                    </div>
                    {!isExpectedGrade ? (
                        <div style={{ width: '100%', height: '6px', borderRadius: '999px', backgroundColor: '#E8E6E3', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', backgroundColor: barColor }} />
                        </div>
                    ) : null}
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
            {hasPrereqConflict && (
                <div style={{ fontSize: '7px', color: '#9A3412', lineHeight: 1.35 }}>
                    Missing prerequisite{missingPrereqCodes.length > 1 ? 's' : ''} from earlier semesters: {' '}
                    {missingPrereqCodes.join(', ')}
                </div>
            )}
            {hasPreclusionConflict && (
                <div style={{ fontSize: '7px', color: '#9A3412', lineHeight: 1.35 }}>
                    Precluded by: {preclusionMessages.join(', ')}
                </div>
            )}
        </div>
    );
}
