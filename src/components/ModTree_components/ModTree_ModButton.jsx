import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { fetchSentiment } from '../../utils/api';
import { lookupModuleMetadata } from './modTreeModuleData';
import { useModuleRecommendation } from '../modRecco/modReccoState';
import { formatConfidence, formatSupport } from '../modRecco/modReccoFormat';
import { useGradeRecommendation } from '../modRecco/gradeReccoState';
import { formatGradeRecommendation } from '../modRecco/gradeReccoFormat';

const sentimentCache = {}
const TOOLTIP_WIDTH = 320
const TOOLTIP_OFFSET = 12

export default function ModuleButton({
    moduleCode,
    isSelected,
    moduleTreeState,
    onToggle,
    fullWidth = false,
    compact = false,
    draggable = false,
    onDragStart,
    onDragEnd,
    showTooltip = true,
    isTaken = false,
}) {
    const recommendation = useModuleRecommendation(moduleCode)
    const gradeRecommendation = useGradeRecommendation(moduleCode)
    const isRecommended = !isSelected && Boolean(recommendation)
    const [isHovered, setIsHovered] = useState(false)
    const [sentiment, setSentiment] = useState(null)
    const [isLoadingSentiment, setIsLoadingSentiment] = useState(false)
    const [matchedModule, setMatchedModule] = useState(null)
    const [loadingModule, setLoadingModule] = useState(true)
    const hoverTimeout = useRef(null)
    const buttonRef = useRef(null)
    const [tooltipPosition, setTooltipPosition] = useState(null)

    // Fetch module metadata from Supabase on mount
    useEffect(() => {
        let isMounted = true;
        lookupModuleMetadata(moduleCode).then(mod => {
            if (isMounted) {
                setMatchedModule(mod);
                setLoadingModule(false);
            }
        });
        return () => { isMounted = false; };
    }, [moduleCode]);

    const bgColor = isSelected ? '#E1F5EE' : isRecommended ? '#E6F1FB' : '#F7F6F2';
    const textColor = isSelected ? '#1D9E75' : isRecommended ? '#185FA5' : '#5F5E5A';
    const borderColor = isSelected ? '#1D9E75' : isRecommended ? '#185FA5' : 'rgba(0,0,0,0.1)';

    const clearHoverTimeout = () => {
        if (hoverTimeout.current) {
            window.clearTimeout(hoverTimeout.current)
            hoverTimeout.current = null
        }
    }

    const handleMouseEnter = () => {
        if (!showTooltip) return
        clearHoverTimeout(); setIsHovered(true);
    }
    const handleMouseLeave = () => {
        if (!showTooltip) return
        clearHoverTimeout()
        hoverTimeout.current = window.setTimeout(() => {
            setIsHovered(false)
            hoverTimeout.current = null
        }, 50)
    }

    // Fetch sentiment on hover
    useEffect(() => {
        if (!isHovered || sentiment) return

        const cacheKey = moduleCode.toUpperCase()
        const cached = sentimentCache[cacheKey]
        if (cached) {
            const frame = window.requestAnimationFrame(() => setSentiment(cached))
            return () => window.cancelAnimationFrame(frame)
        }

        let isMounted = true
        const loadingFrame = window.requestAnimationFrame(() => {
            if (isMounted) {
                setIsLoadingSentiment(true)
            }
        })

        fetchSentiment(cacheKey)
            .then((data) => {
                if (isMounted) {
                    sentimentCache[cacheKey] = data
                    setSentiment(data)
                }
            })
            .finally(() => { if (isMounted) setIsLoadingSentiment(false) })

        return () => {
            isMounted = false
            window.cancelAnimationFrame(loadingFrame)
        }
    }, [isHovered, moduleCode, sentiment])

    useEffect(() => {
        if (!isHovered) {
            return
        }

        const updateTooltipPosition = () => {
            const rect = buttonRef.current?.getBoundingClientRect()
            if (!rect) {
                return
            }

            const spaceRight = window.innerWidth - rect.right
            const spaceLeft = rect.left
            const placeLeft = spaceRight < TOOLTIP_WIDTH + TOOLTIP_OFFSET && spaceLeft > spaceRight
            const left = placeLeft
                ? Math.max(8, rect.left - TOOLTIP_WIDTH - TOOLTIP_OFFSET)
                : rect.right + TOOLTIP_OFFSET

            setTooltipPosition({
                top: Math.max(8, rect.top),
                left: Math.max(8, left),
            })
        }

        const frame = window.requestAnimationFrame(updateTooltipPosition)
        window.addEventListener('scroll', updateTooltipPosition, true)
        window.addEventListener('resize', updateTooltipPosition)

        return () => {
            window.cancelAnimationFrame(frame)
            window.removeEventListener('scroll', updateTooltipPosition, true)
            window.removeEventListener('resize', updateTooltipPosition)
        }
    }, [isHovered])

    if (loadingModule) {
        return (
            <button disabled style={{ padding: compact ? '8px 12px' : '10px 16px', borderRadius: '10px', opacity: 0.5, fontSize: compact ? '12px' : '14px' }}>
                …
            </button>
        );
    }

    if (!matchedModule) {
        return <button disabled>Unknown</button>;
    }

    const displayCode = (matchedModule.id ?? moduleCode).toUpperCase();

    const renderSentimentRows = () => {
        const workload = sentiment?.workload
        const difficulty = sentiment?.difficulty

        const renderCompactAspect = (label, aspect) => {
            const pct = Math.round(Math.max(0, Math.min(1, aspect.score)) * 100)
            const barColor = label === 'Workload' ? '#D85A30' : '#185FA5'

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
            )
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px' }}>
                {sentiment && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        {renderCompactAspect('Workload', workload)}
                        {renderCompactAspect('Difficulty', difficulty)}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: '600', color: '#42413F' }}>
                    <span>Expected Grade</span>
                    <span>{formatGradeRecommendation(gradeRecommendation)}</span>
                </div>
            </div>
        )
    }

    return (
        <>
            <div
                className="tooltip-container"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{ position: 'relative', display: 'inline-block' }}
            >
                <button
                    ref={buttonRef}
                    draggable={draggable}
                    onDragStart={draggable ? (event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', moduleCode);
                        onDragStart?.(event);
                    } : undefined}
                    onDragEnd={onDragEnd}
                    onClick={() => onToggle?.()}
                    style={{
                        width: fullWidth ? '100%' : 'auto',
                        padding: compact ? '8px 12px' : '10px 16px', borderRadius: '10px',
                        backgroundColor: bgColor,
                        color: textColor,
                        border: `2px solid ${borderColor}`,
                        fontWeight: isSelected ? '600' : '500',
                        opacity: 1,
                        transition: 'all 0.15s ease-in-out',
                        textAlign: 'left',
                        fontSize: compact ? '12px' : '14px',
                        lineHeight: 1.3,
                        cursor: draggable ? 'grab' : 'pointer',
                    }}>
                    {displayCode}
                </button>
                {isTaken ? (
                    <span
                        title="You've taken this module (from GPA Calculator / Profile)"
                        style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '999px',
                            backgroundColor: '#2564F8',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                            pointerEvents: 'none',
                        }}
                    >
                        ✓
                    </span>
                ) : null}
            </div>
            {isHovered && tooltipPosition && typeof document !== 'undefined' ? createPortal(
                <div
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    style={{
                        position: 'fixed',
                        top: tooltipPosition.top,
                        left: tooltipPosition.left,
                        transform: 'translateY(0)',
                        backgroundColor: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        padding: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        zIndex: 2000,
                        width: '320px',
                        maxWidth: 'calc(100vw - 16px)',
                        fontSize: '13px',
                        color: '#1a1a18',
                        lineHeight: '1.5'
                    }}
                >
                    <Link
                        to={`/insights/${encodeURIComponent(matchedModule.id ?? moduleCode)}`}
                        state={{
                            from: '/moduleTree',
                            moduleTreeState: {
                                ...moduleTreeState,
                                scrollPosition: window.scrollY,
                            },
                        }}
                        style={{
                            display: 'block',
                            margin: '0 0 8px 0',
                            fontWeight: '600',
                            color: textColor,
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
                        {displayCode}
                    </Link>

                    <p style={{ margin: '0', color: '#5F5E5A', fontSize: '12px' }}>
                        {matchedModule.description}
                    </p>

                    {isRecommended && (
                        <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', backgroundColor: '#E6F1FB', border: '1px solid rgba(24, 95, 165, 0.2)' }}>
                            <p style={{ margin: 0, color: '#185FA5', fontSize: '12px', fontWeight: '700' }}>
                                Recommended because you took: {recommendation.antecedentModules.join(' + ')}
                            </p>
                            <p style={{ margin: '4px 0 0', color: '#42413f', fontSize: '12px' }}>
                                Students that also took this module: {formatConfidence(recommendation.overall.confidence)}
                                {formatSupport(recommendation.overall.ruleSupport, recommendation.overall.antecedentSupport)
                                    ? ` (${formatSupport(recommendation.overall.ruleSupport, recommendation.overall.antecedentSupport)})`
                                    : ''}
                            </p>
                            {formatConfidence(recommendation.sameMajor.confidence) ? (
                                <p style={{ margin: '4px 0 0', color: '#42413f', fontSize: '12px' }}>
                                    Same primary major: {formatConfidence(recommendation.sameMajor.confidence)} confidence
                                    {formatSupport(recommendation.sameMajor.ruleSupport, recommendation.sameMajor.antecedentSupport)
                                        ? ` (${formatSupport(recommendation.sameMajor.ruleSupport, recommendation.sameMajor.antecedentSupport)})`
                                        : ''}
                                </p>
                            ) : (
                                <p style={{ margin: '4px 0 0', color: '#5F5E5A', fontSize: '12px' }}>
                                    Insufficient same-primary-major data.
                                </p>
                            )}
                        </div>
                    )}

                    {isLoadingSentiment && (
                        <p style={{ margin: '10px 0 0', color: '#7a766f', fontSize: '12px' }}>
                            Loading review insights...
                        </p>
                    )}
                    {renderSentimentRows()}

                    {sentiment && (
                        <p style={{ margin: '10px 0 0', color: '#7a766f', fontSize: '11px' }}>
                            Based on {sentiment.reviewCount} reviews
                        </p>
                    )}
                </div>,
                document.body
            ) : null}
        </>
    )
}
