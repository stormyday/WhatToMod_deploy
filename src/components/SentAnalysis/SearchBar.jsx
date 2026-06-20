import React from "react";

export function SearchBar({ query, onChange, suggestions, onSelect, onDismiss, loading }) {
  return (
    <div className="search-wrap">
      <div className="search-bar">
        <span className="search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search module code or title..."
        />
        {loading && <div className="search-spinner" />}
        {query && !loading && (
          <button className="search-clear" onClick={onDismiss}>✕</button>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="suggestions">
          {suggestions.map((s) => (
            <li
              key={s.moduleCode}
              className="suggestion-item"
              onClick={() => onSelect(s.moduleCode)}
            >
              <span className="suggestion-code">{s.moduleCode}</span>
              <span className="suggestion-title">{s.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}