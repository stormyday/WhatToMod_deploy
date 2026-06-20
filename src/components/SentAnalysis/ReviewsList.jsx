// src/components/SentAnalysis/ReviewsList.tsx
import { useState } from "react";


const PAGE_SIZE = 10;
const FILTER_OPTIONS = ["All", "Workload", "Difficulty", "Tips", "Grade", "Assessment", "Content"];

const TAG_COLORS= {
  Workload:   { bg: "#FAEEDA", color: "#633806" },
  Difficulty: { bg: "#E6F1FB", color: "#0C447C" },
  Tips:       { bg: "#EAF3DE", color: "#27500A" },
  Grade:      { bg: "#E1F5EE", color: "#085041" },
  General:    { bg: "#F1EFE8", color: "#444441" },
  "Assessment": { bg: "#F3E8FF", color: "#581C87" },
  Content: { bg: "#eded6d", color: "#949f35" }
};

const FILTER_KEYWORDS = {
  Workload:   /workload|assignment|hours|project|deadline|week/i,
  Difficulty: /hard|difficult|challeng|tough|content|concept|math/i,
  Tips:       /tip|advice|recommend|suggest|attend|lecture|prepare|warning/i,
  Grade:      /grade|bell curve|a-|b\+|b plus|score|marks|gpa/i,
  "Assessment": /assess|midterm|finals?|exam|quiz|test|practical|pyp|weightage/i,
  Content: /topic|covered|material|content|syllabus/i,
};

function inferTags(text) {
  const tags = [];
  
  // Loop through each category key and run its test against the text
  Object.entries(FILTER_KEYWORDS).forEach(([category, regex]) => {
    if (regex.test(text)) {
      tags.push(category);
    }
  });

  if (tags.length === 0) {
    tags.push("General");
  }
  return tags;
}

function extractRelevantContent(text, activeFilter) {
  if (activeFilter === "All" || activeFilter === "General") return text;
  const blocks = text.split(/(?=\n- |\n\n|\n*)/g); 
  
  const regex = FILTER_KEYWORDS[activeFilter];
  if (!regex) return text;

  const matchingBlocks = blocks.filter(block => regex.test(block));

  return matchingBlocks.length > 0 
    ? matchingBlocks.join("\n\n").trim() 
    : text;
}

function ReviewCard({review, activeFilter }) {
  const [expanded, setExpanded] = useState(false);
  const tags = inferTags(review.text);

  const selectedReview = extractRelevantContent(review.text, activeFilter) || "";

  const isLong = selectedReview.length > 280;
  const display = isLong && !expanded ? selectedReview.slice(0, 280) + "…" : selectedReview;

  const visibleTags = (activeFilter === "All" || activeFilter === "General")
    ? tags
    : tags.filter(tag => tag === activeFilter);

  return (
    <article className="review-card">
      <div className="review-meta">
        <div className="review-tags">
          {visibleTags.map((tag) => {
            const c = TAG_COLORS[tag] ?? TAG_COLORS.General;
            return (
              <span
                key={tag}
                className="review-tag"
                style={{ background: c.bg, color: c.color }}
              >
                {tag}
              </span>
            );
          })}
        </div>
        {review.semester && (
          <span className="review-semester">{review.semester}</span>
        )}
      </div>

      <p className="review-text">{display}</p>

      {isLong && (
        <button
          className="review-expand"
          onClick={() => setExpanded((p) => !p)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </article>
  );
}

export function ReviewsList({ reviews }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("All");

  const filtered =
    filter === "All"
      ? reviews
      : reviews.filter((r) => inferTags(r.text).includes(filter));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const visible = filtered.slice(0, page * PAGE_SIZE);

  return (
    <section className="reviews-section" aria-label="Student reviews">
      <div className="reviews-header">
        <h2 className="reviews-title">
          Student reviews
          <span className="reviews-count">{reviews.length}</span>
        </h2>

        <div className="reviews-filters" role="group" aria-label="Filter by topic">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? " active" : ""}`}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-reviews">
          <p>No reviews match this filter.</p>
        </div>
      ) : (
        <>
          <div className="reviews-list">
            {visible.map((r) => (
              <ReviewCard key={r.id} review={r} activeFilter={filter} />
            ))}
          </div>

          {page < totalPages && (
            <button
              className="load-more"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more ({filtered.length - visible.length} remaining)
            </button>
          )}
        </>
      )}
    </section>
  );
}