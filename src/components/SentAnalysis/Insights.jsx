import { useRef } from "react";
import { useNavigate } from 'react-router-dom';
import { useModuleSearch } from "../../hooks/useModuleSearch";
import { SearchBar } from "./SearchBar";
import { SentimentSummary } from "./SentimentSummary";
import { ReviewsList } from "./ReviewsList";
import { ModuleDetails } from "./ModuleDetails";
import { SkeletonLoader } from "./SkeletonLoader";
import "./SentDash.css";

export default function Insights() {
  const {
    query, setQuery,
    suggestions, setSuggestions,
    result, loading, error,
    loadModule,
  } = useModuleSearch();

  const navigate = useNavigate();

  const resultsRef = useRef(null);
 
  function handleSelect(code) {
    loadModule(code);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }
 
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <button id= "back-button" onClick={() => navigate('/dashboard')}> Back
          </button>
        </div>
        <div className="header-inner">
          <div className="logo-row">
            <h1 className="logo-text" style={{fontFamily: "League Spartan", fontWeight: 700,}}><span style={{color: "#F76F44"}}>Mod</span><span style={{color: "#2564F8"}}>Search</span></h1>
          </div>
 
          <SearchBar
            query={query}
            onChange={setQuery}
            suggestions={suggestions}
            onSelect={handleSelect}
            onDismiss={() => setSuggestions([])}
            loading={loading}
          />
        </div>
      </header>
 
      <main className="main" ref={resultsRef}>
        {!loading && !result && !error && (
          <div className="empty-state">
            <p className="empty-heading">Search for a module to get started</p>
          </div>
        )}
 
        {loading && <SkeletonLoader />}
 
        {error && (
          <div className="error-banner" role="alert">
            <strong>Could not load module.</strong> {error}
          </div>
        )}
 
        {result && !loading && (
          <div className="module-page">
            {/* Module header */}
            <div className="module-header">
              <div className="module-title-row">
                <span className="module-code">{result.module.moduleCode}</span>
                <span className="module-title">{result.module.title}</span>
              </div>
              <div className="module-tags">
                <span className="mod-tag mc">{result.module.moduleCredit} MCs</span>
                {result.module.semesterData.map((s) => (
                  <span key={s.semester} className="mod-tag sem">Sem {s.semester}</span>
                ))}
                <span className="mod-tag dept">{result.module.faculty}</span>
              </div>
              <p className="module-desc">{result.module.description}</p>
            </div>
 
            <SentimentSummary sentiment={result.sentiment} />
 
            <ReviewsList reviews={result.reviews} />

            <ModuleDetails module={result.module} />
          </div>
        )}
      </main>
 
      <footer className="app-footer">
        <p>Data from <a href="https://api.nusmods.com" target="_blank" rel="noopener noreferrer">NUSMods</a></p>
      </footer>
    </div>
  );
}