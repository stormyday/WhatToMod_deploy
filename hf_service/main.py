"""
NUSMods Sentiment Analysis Microservice
Run: uvicorn main:app --port 8000 --reload
"""

from __future__ import annotations

import re
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

# ─── Models ──────────────────────────────────────────────────────────────────

# Zero-shot classifier for aspect detection (workload / difficulty / grade / vibe)
print("[hf] Loading zero-shot classifier...")
classifier = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli",
    device=-1,           # CPU; set to 0 for CUDA GPU
)

# Sentiment pipeline for per-review positive/negative scoring
print("[hf] Loading sentiment pipeline...")
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    device=-1,
)
print("[hf] Models ready.")

app = FastAPI(title="NUSMods Sentiment Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request / Response schemas ───────────────────────────────────────────────

class AnalyseRequest(BaseModel):
    moduleCode: str
    texts: list[str]


class AspectScore(BaseModel):
    label: str
    level: str
    score: float
    descriptor: str


class SentimentSummary(BaseModel):
    moduleCode: str
    reviewCount: int
    workload: AspectScore
    difficulty: AspectScore
    expectedGrade: AspectScore
    overallVibe: AspectScore
    tips: list[str]
    generatedAt: str


# ─── Aspect config ─────────────────────────────────────────────────────────────

WORKLOAD_LABELS = [
    "very light workload",
    "light workload",
    "moderate workload",
    "heavy workload",
    "very heavy workload",
]

DIFFICULTY_LABELS = [
    "very easy course",
    "easy course",
    "moderately difficult course",
    "difficult course",
    "very difficult course",
]

GRADE_LABELS = [
    "students get A or A+",
    "students get A- or A",
    "students get B+ or A-",
    "students get B or B+",
    "students get B- or below",
]

TIPS_HYPOTHESES = [
    "students recommend attending lectures",
    "students recommend starting assignments early",
    "students recommend forming study groups",
    "students recommend focusing on past year papers",
    "students recommend having strong prerequisites",
    "students say the textbook is useful",
    "students say participation matters",
    "students say the project is important",
]

LEVEL_MAPS: dict[str, list[tuple[float, str, str]]] = {
    "workload": [
        (0.2, "Very Light", "minimal commitment"),
        (0.4, "Light", "easy to manage"),
        (0.6, "Moderate", "manageable"),
        (0.75, "Heavy", "~10 hrs/week"),
        (1.0, "Very Heavy", "very demanding"),
    ],
    "difficulty": [
        (0.2, "Very Easy", "straightforward"),
        (0.4, "Easy", "accessible"),
        (0.6, "Moderate", "some challenge"),
        (0.75, "Hard", "maths-heavy"),
        (1.0, "Very Hard", "demanding"),
    ],
    "grade": [
        (0.2, "B− or below", "tough bell curve"),
        (0.4, "B / B+", "fair bell curve"),
        (0.6, "B+ / A−", "moderate bell curve"),
        (0.85, "A− / A", "achievable"),
        (1.0, "A / A+", "generous grading"),
    ],
    "vibe": [
        (0.2, "Very Negative", "most disliked it"),
        (0.4, "Mixed", "divisive opinions"),
        (0.6, "Mostly Positive", "generally liked"),
        (0.8, "Positive", "well-received"),
        (1.0, "Very Positive", "highly recommended"),
    ],
}


def score_to_level(score: float, category: str) -> tuple[str, str]:
    for threshold, level, descriptor in LEVEL_MAPS[category]:
        if score <= threshold:
            return level, descriptor
    last = LEVEL_MAPS[category][-1]
    return last[1], last[2]


def batch_classify(texts: list[str], labels: list[str], batch_size: int = 16) -> list[dict[str, Any]]:
    """Run zero-shot classification in batches to avoid OOM."""
    results = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        out = classifier(batch, candidate_labels=labels, multi_label=False)
        if isinstance(out, dict):
            out = [out]
        results.extend(out)
    return results


def extract_tips(texts: list[str]) -> list[str]:
    """Identify the top-3 student tips by zero-shot hypothesis scoring."""
    # Sample up to 60 reviews for speed
    sample = texts[:60]
    agg: dict[str, float] = {h: 0.0 for h in TIPS_HYPOTHESES}

    results = batch_classify(sample, TIPS_HYPOTHESES)
    for r in results:
        for label, score in zip(r["labels"], r["scores"]):
            agg[label] += score

    ranked = sorted(agg.items(), key=lambda x: x[1], reverse=True)
    top3 = [tip for tip, _ in ranked[:3]]

    # Humanise the hypothesis strings
    cleaned = []
    for tip in top3:
        tip = re.sub(r"^students (recommend|say) ", "", tip)
        cleaned.append(tip.capitalize())
    return cleaned


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@app.post("/analyse", response_model=SentimentSummary)
async def analyse(req: AnalyseRequest) -> SentimentSummary:
    texts = req.texts
    if not texts:
        raise HTTPException(status_code=400, detail="No review texts provided")

    # Cap at 200 reviews for reasonable latency
    sample = texts[:200]

    # ── Workload ──────────────────────────────────────────────────────────────
    wl_results = batch_classify(sample, WORKLOAD_LABELS)
    wl_score_raw = sum(
        r["scores"][r["labels"].index(l)] * (i / (len(WORKLOAD_LABELS) - 1))
        for r in wl_results
        for i, l in enumerate(WORKLOAD_LABELS)
        if l == r["labels"][0]
    ) / len(sample)
    wl_level, wl_desc = score_to_level(wl_score_raw, "workload")

    # ── Difficulty ────────────────────────────────────────────────────────────
    diff_results = batch_classify(sample, DIFFICULTY_LABELS)
    diff_score_raw = sum(
        r["scores"][r["labels"].index(l)] * (i / (len(DIFFICULTY_LABELS) - 1))
        for r in diff_results
        for i, l in enumerate(DIFFICULTY_LABELS)
        if l == r["labels"][0]
    ) / len(sample)
    diff_level, diff_desc = score_to_level(diff_score_raw, "difficulty")

    # ── Grade ─────────────────────────────────────────────────────────────────
    grade_results = batch_classify(sample, GRADE_LABELS)
    # Grade labels are ordered best→worst; invert so higher = better
    grade_score_raw = sum(
        r["scores"][r["labels"].index(l)] * (1 - i / (len(GRADE_LABELS) - 1))
        for r in grade_results
        for i, l in enumerate(GRADE_LABELS)
        if l == r["labels"][0]
    ) / len(sample)
    grade_level, grade_desc = score_to_level(grade_score_raw, "grade")

    # ── Overall vibe ──────────────────────────────────────────────────────────
    vibe_results = sentiment_pipe(sample, truncation=True, max_length=512)
    pos_scores = [
        r["score"] if r["label"] == "positive" else (1 - r["score"])
        for r in vibe_results
    ]
    vibe_score = sum(pos_scores) / len(pos_scores)
    vibe_level, vibe_desc = score_to_level(vibe_score, "vibe")

    # ── Tips ──────────────────────────────────────────────────────────────────
    tips = extract_tips(sample)

    return SentimentSummary(
        moduleCode=req.moduleCode,
        reviewCount=len(texts),
        workload=AspectScore(
            label="Workload",
            level=wl_level,
            score=round(wl_score_raw, 3),
            descriptor=wl_desc,
        ),
        difficulty=AspectScore(
            label="Difficulty",
            level=diff_level,
            score=round(diff_score_raw, 3),
            descriptor=diff_desc,
        ),
        expectedGrade=AspectScore(
            label="Expected grade",
            level=grade_level,
            score=round(grade_score_raw, 3),
            descriptor=grade_desc,
        ),
        overallVibe=AspectScore(
            label="Overall vibe",
            level=vibe_level,
            score=round(vibe_score, 3),
            descriptor=vibe_desc,
        ),
        tips=tips,
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}