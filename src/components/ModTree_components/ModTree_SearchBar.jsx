import { useState } from 'react';

export function ModTreeSearchBar({
  query,
  onChange,
  suggestions,
  onSelect,
  onDismiss,
  loading,
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: isFocused ? '#ffffff' : '#f1efe8',
          border: `1.5px solid ${isFocused ? '#185fa5' : 'rgba(0, 0, 0, 0.1)'}`,
          borderRadius: '12px',
          padding: '0 14px',
          height: '50px',
          transition: 'border-color 0.15s ease, background 0.15s ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '18px',
            height: '18px',
            color: '#888780',
            flexShrink: 0,
          }}
        >
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Search any module to add it to ModTree..."
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: '15px',
            color: '#1a1a18',
            outline: 'none',
            fontFamily: '"Inter", "Helvetica Neue", system-ui, sans-serif',
          }}
        />
        {loading && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="rgba(0, 0, 0, 0.1)"
              strokeWidth="2"
            />
            <path
              d="M8 2a6 6 0 0 1 6 6"
              fill="none"
              stroke="#185fa5"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                attributeType="XML"
                type="rotate"
                from="0 8 8"
                to="360 8 8"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        )}
        {query && !loading && (
          <button
            type="button"
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: '#888780',
              fontSize: '14px',
              padding: '2px 4px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            listStyle: 'none',
            zIndex: 100,
            overflow: 'hidden',
            margin: 0,
            padding: 0,
          }}
        >
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.moduleCode}
              onClick={() => onSelect(suggestion)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                cursor: 'pointer',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = '#f1efe8';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = '#ffffff';
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#185fa5',
                  minWidth: '76px',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                }}
              >
                {suggestion.moduleCode.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: '13px',
                  color: '#1a1a18',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {suggestion.title}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  flexShrink: 0,
                  color: suggestion.hasModTreeMetadata ? '#1d9e75' : '#d85a30',
                  background: suggestion.hasModTreeMetadata ? '#e1f5ee' : '#faece7',
                }}
              >
                {suggestion.hasModTreeMetadata ? 'ModTree' : 'Fallback'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
