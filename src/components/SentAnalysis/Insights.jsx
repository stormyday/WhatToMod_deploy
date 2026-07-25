import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useModuleSearch } from "../../hooks/useModuleSearch";
import { SearchBar } from "./SearchBar";
import { SentimentSummary } from "./SentimentSummary";
import { ReviewsList } from "./ReviewsList";
import { SkeletonLoader } from "./SkeletonLoader";
import { AspectBreakdown } from "./AspectBreakdown";
import "./SentDash.css";

export default function Insights() {
  const [activeTab, setActiveTab] = useState("overview");
  
  const {
    query, setQuery,
    suggestions, setSuggestions,
    result, loading, error,
    loadModule,
  } = useModuleSearch();

  const navigate = useNavigate();
  const location = useLocation();
  const { moduleCode } = useParams();

  const resultsRef = useRef(null);
 
  useEffect(() => {
    if (moduleCode) {
      loadModule(moduleCode);
    }
  }, [moduleCode, loadModule]);

  function handleSelect(code) {
    loadModule(code);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }
 
  return (
    <div className="app">
      <header className="app-header">
        <div>
          <button
            id="back-button"
            className="text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition"
            onClick={() => {
              if (location.state?.from === '/moduleTree' && location.state.moduleTreeState) {
                navigate('/moduleTree', { state: location.state.moduleTreeState });
              } else if (moduleCode) {
                navigate('/insights');
              } else {
                navigate('/dashboard');
              }
            }}
          >
            ← Back
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
            <p className="empty-heading">Search for any module</p>
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
            
            <div className="tab-bar" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === "overview"}
                className={`tab-button tab-overview ${activeTab === "overview" ? "active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                role="tab"
                aria-selected={activeTab === "aspects"}
                className={`tab-button tab-aspects ${activeTab === "aspects" ? "active" : ""}`}
                onClick={() => setActiveTab("aspects")}
              >
                LLM Curated Insights
              </button>
            </div>
 
            {activeTab === "overview" && (
              <>
                <SentimentSummary sentiment={result.sentiment} />
                <ReviewsList reviews={result.reviews} />
              </>
            )}
 
            {activeTab === "aspects" && (
              <AspectBreakdown
                moduleCode={result.module.moduleCode}
                moduleAspects={result.moduleAspects}
                keyInfo={result.keyInfo}
                suggestions={result.suggestions}
                professors={result.professors}
              />
            )}
 
          </div>
        )}
      </main>
 
      <footer className="app-footer">
        <p>Data from <a href={`https://nusmods.com/modules/${result?.module?.moduleCode}`} target="_blank" rel="noopener noreferrer">NUSMods</a></p>
      </footer>
    </div>
  );
}
