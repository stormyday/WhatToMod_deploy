export default function ModTreeProgressBar({ completed = 0, total = 0 }) {
    const safeCompleted = Number.isFinite(completed) ? Math.max(0, completed) : 0;
    const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
    const percentage = safeTotal > 0 ? Math.min(100, Math.round((safeCompleted / safeTotal) * 100)) : 0;

    return (
        <div
            style={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '14px',
                backgroundColor: '#ffffff',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '12px',
                    marginBottom: '10px',
                }}
            >
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a18' }}>
                    ModTree completion
                </div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A' }}>
                    {safeCompleted} / {safeTotal} components
                </div>
            </div>

            <div
                style={{
                    height: '12px',
                    borderRadius: '999px',
                    backgroundColor: '#E8E6E3',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        width: `${percentage}%`,
                        height: '100%',
                        borderRadius: '999px',
                        background: 'linear-gradient(90deg, #185FA5 0%, #1D9E75 100%)',
                        transition: 'width 0.25s ease',
                    }}
                />
            </div>
        </div>
    );
}
