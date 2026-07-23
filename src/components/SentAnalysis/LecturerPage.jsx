import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { LuFrown, LuUser } from "react-icons/lu";
import { useProfessorProfile } from "../../hooks/useProfessorProfile";
import { SkeletonLoader } from "./SkeletonLoader";
import "./SentDash.css";

function semesterLabel(semesters) {
  const known = semesters.filter((s) => s !== "Unclear");
  return known.length > 0 ? known.join(", ") : "Semester unclear";
}

function ModuleChip({ moduleCode, semesters, mentionCount, onSelect }) {
  return (
    <button
      type="button"
      className="mod-tag sem lecturer-mod-chip"
      onClick={() => onSelect(moduleCode)}
      title={`${semesterLabel(semesters)} · mentioned in ${mentionCount} review${mentionCount !== 1 ? "s" : ""}`}
    >
      {moduleCode}
    </button>
  );
}

function ReviewMentionCard({ review }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.text.length > 280;
  const display = isLong && !expanded ? review.text.slice(0, 280) + "…" : review.text;

  return (
    <article className="review-card">
      <div className="review-meta">
        <span className="review-tag" style={{ background: "var(--blue-bg)", color: "var(--blue-dark)" }}>
          {review.moduleCode}
        </span>
        {review.semester && <span className="review-semester">{review.semester}</span>}
      </div>
      <p className="review-text">{display}</p>
      {isLong && (
        <button className="review-expand" onClick={() => setExpanded((p) => !p)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </article>
  );
}

export default function LecturerPage() {
  const { name: encodedName } = useParams();
  const name = decodeURIComponent(encodedName ?? "");
  const navigate = useNavigate();
  const location = useLocation();
  const fromModuleCode = location.state?.fromModuleCode;

  const { profile, loading, error } = useProfessorProfile(name, fromModuleCode);

  function goToModule(code) {
    navigate(`/insights/${code}`);
  }

  const relatedByName = (profile?.relatedModules ?? []).reduce((acc, m) => {
    (acc[m.name] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <button
            id="back-button"
            onClick={() => navigate(fromModuleCode ? `/insights/${fromModuleCode}` : "/insights")}
          >
            Back
          </button>
        </div>
        <div className="header-inner">
          <div className="logo-row">
            <LuUser size={20} />
            <h1 className="logo-text">{name}</h1>
          </div>
        </div>
      </header>

      <main className="main">
        {loading && <SkeletonLoader />}

        {error && (
          <div className="error-banner" role="alert">
            <strong>Could not load lecturer.</strong> {error}
          </div>
        )}

        {!loading && !error && profile && (
          <div className="module-page">
            <section aria-label="Modules taught">
              <p className="aspect-breakdown-label">Teaches:</p>
              {profile.modules.length === 0 ? (
                <p className="no-data-note">No reviews mention this name yet.</p>
              ) : (
                <div className="professors-row">
                  {profile.modules.map((m) => (
                    <ModuleChip key={m.moduleCode} {...m} onSelect={goToModule} />
                  ))}
                </div>
              )}
            </section>

            {Object.keys(relatedByName).length > 0 && (
              <section aria-label="Possibly the same lecturer">
                <p className="aspect-breakdown-label">This prof may also be teaching:</p>
                <p className="text-xs text-red-600 inline-flex items-center gap-1">
                  *Names look similar but aren't confirmed to be the same person
                  <LuFrown size={10} />
                </p>
                <div className="professors-by-sem">
                  {Object.entries(relatedByName).map(([altName, mods]) => (
                    <div key={altName} className="professor-sem-group">
                      <p className="professor-sem-heading">{altName}</p>
                      <div className="professors-row">
                        {mods.map((m) => (
                          <ModuleChip key={m.moduleCode} {...m} onSelect={goToModule} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="reviews-section" aria-label="Review mentions">
              <h2 className="reviews-title">
                Mentioned in reviews
                <span className="reviews-count">{profile.reviewMentions.length}</span>
              </h2>

              {profile.reviewMentions.length === 0 ? (
                <div className="empty-reviews">
                  <p>No reviews mention "{name}" yet.</p>
                </div>
              ) : (
                <div className="reviews-list">
                  {profile.reviewMentions.map((r) => (
                    <ReviewMentionCard key={r.id} review={r} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
