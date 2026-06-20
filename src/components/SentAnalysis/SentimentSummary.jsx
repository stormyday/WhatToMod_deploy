const ASPECT_COLORS = {
  workload:      "#D85A30",
  difficulty:    "#185FA5",
  expectedGrade: "#1D9E75",
  overallVibe:   "#534AB7",
};

function AspectCard({ aspectKey, label, level, score, descriptor }) {
  const barColor = ASPECT_COLORS[aspectKey] ?? "#534AB7";
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);

  return (
    <div className="aspect-card">
      <p className="aspect-label">{label}</p>
      <p className="aspect-level">{level}</p>
      <div className="aspect-bar-track">
        <div
          className="aspect-bar-fill"
          style={{ width: `${pct}%`, background: barColor }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="aspect-desc">{descriptor}</p>
    </div>
  );
}

export function SentimentSummary({ sentiment }) {
  const aspects = [
    { key: "workload",      ...sentiment.workload },
    { key: "difficulty",    ...sentiment.difficulty },
    { key: "expectedGrade", ...sentiment.expectedGrade },
    //{ key: "overallVibe",   ...sentiment.overallVibe },
  ];

  return (
    <section className="sentiment-card" aria-label="AI sentiment summary">
      <header className="sentiment-header">
        <div className="sentiment-title-row">
          <h2 className="sentiment-title">General Consensus</h2>
        </div>
        <span className="sentiment-count">
          Based on {sentiment.reviewCount} review{sentiment.reviewCount !== 1 ? "s" : ""}
        </span>
      </header>

      <div className="aspects-grid">
        {aspects.map((a) => (
          <AspectCard
            key={a.key}
            aspectKey={a.key}
            label={a.label}
            level={a.level}
            score={a.score}
            descriptor={a.descriptor}
          />
        ))}
      </div>

      {sentiment.tips.length > 0 && (
        <div className="tips-box">
          <p className="tips-label">Student tips</p>
          <ul className="tips-list">
            {sentiment.tips.map((tip, i) => (
              <li key={i} className="tip-item">
                <span className="tip-check" aria-hidden="true">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sentiment.reviewCount === 0 && (
        <p className="no-data-note">
          No reviews scraped yet. Run the scraper first, then restart the backend.
        </p>
      )}
    </section>
  );
}