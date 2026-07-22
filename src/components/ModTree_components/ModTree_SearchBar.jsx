import "./ModTree_SearchBar.css";

export function ModTreeSearchBar({
  query,
  onChange,
  suggestions,
  onSelect,
  onDismiss,
  loading,
}) {
  return (
    <div className="modtree-search-wrap">
      <div className="modtree-search-bar">
        <span className="modtree-search-icon" aria-hidden="true">🔍</span>
        <input
          type="text"
          className="modtree-search-input"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search any module to add it to ModTree..."
        />
        {loading && <div className="modtree-search-spinner" />}
        {query && !loading && (
          <button
            type="button"
            className="modtree-search-clear"
            onClick={onDismiss}
          >
            ✕
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <ul className="modtree-suggestions">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.moduleCode}
              className="modtree-suggestion-item"
              onClick={() => onSelect(suggestion)}
            >
              <span className="modtree-suggestion-code">{suggestion.moduleCode.toUpperCase()}</span>
              <span className="modtree-suggestion-title">{suggestion.title}</span>
              <span
                className={`modtree-suggestion-source ${
                  suggestion.hasModTreeMetadata ? "modtree" : "fallback"
                }`}
              >
                {suggestion.hasModTreeMetadata ? "ModTree" : "Fallback"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
