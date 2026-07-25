import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";
import { config } from "dotenv";
import OpenAI from "openai";

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"; 
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const ANALYSIS_SCHEMA = {
  name: "module_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      workload_level: { type: "string", enum: ["Light Workload", "Moderate Workload", "Heavy Workload"] },
      workload_score: { type: "number", minimum: 0, maximum: 1 },
      workload_desc: { type: "string" },
      difficulty_level: { type: "string", enum: ["Easy", "Adequate", "Challenging"] },
      difficulty_score: { type: "number", minimum: 0, maximum: 1 },
      difficulty_desc: { type: "string" },
      grade_level: { type: "string", enum: ["B- or Lower", "B / B+ Average", "B+ or Higher"] },
      grade_desc: { type: "string" },
      tips: { type: "array", items: { type: "string" }, maxItems: 3 },

      // ABSA
      aspects: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            aspect: { type: "string", enum: [
              "lectures", "assignments", "exams", "group_projects",
              "content_difficulty", "staff_teaching", "workload_balance", "tutorials"
            ]},
            sentiment: { type: "string", enum: ["positive", "negative", "mixed", "neutral"] },
            note: { type: "string" }
          },
          required: ["aspect", "sentiment", "note"]
        }
      },

      key_info: {
        type: "object",
        additionalProperties: false,
        properties: {
          estimated_hours_per_week: { type: ["number", "null"] },
          exam_format: { type: "string", enum: [
            "open_book", "closed_book", "take_home", "proctored_online", "no_exam", "unclear"
          ]},
          readings_helpful: { type: "string", enum: ["helpful", "not_helpful", "mixed", "not_mentioned"] },
          is_fluff_mod: { type: ["boolean", "null"] }
        },
        required: ["estimated_hours_per_week", "exam_format", "readings_helpful", "is_fluff_mod"]
      },

      suggestions: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            category: { type: "string", enum: [
              "teaching_style", "resource_request", "assessment_feedback",
              "workload_adjustment", "other"
            ]},
            suggestion: { type: "string" }
          },
          required: ["category", "suggestion"]
        }
      },

      professors: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            semester: { type: "string", enum: [
              "Semester 1", "Semester 2", "Special Term I", "Special Term II", "Unclear"
            ]},
            mention_count: { type: "integer", minimum: 1 }
          },
          required: ["name", "semester", "mention_count"]
        }
      }
    },
    required: [
      "workload_level", "workload_score", "workload_desc",
      "difficulty_level", "difficulty_score", "difficulty_desc",
      "grade_level", "grade_desc", "tips",
      "aspects", "key_info", "suggestions", "professors"
    ]
  }
};

const WORKLOAD_SCORE_BANDS = {
  "Light Workload":   [0.05, 0.35],
  "Moderate Workload": [0.35, 0.65],
  "Heavy Workload":   [0.65, 0.95],
};
const DIFFICULTY_SCORE_BANDS = {
  "Easy":        [0.05, 0.35],
  "Adequate":    [0.35, 0.65],
  "Challenging": [0.65, 0.95],
};

function remapScoreToBand(level, rawScore, bands) {
  const [lo, hi] = bands[level] ?? [0.35, 0.65]; // fallback band if level is somehow unrecognised
  const clamped = Math.max(0, Math.min(1, typeof rawScore === "number" ? rawScore : 0.5));
  return +(lo + (hi - lo) * clamped).toFixed(3);
}

//set budget
const DAILY_TOKEN_BUDGET = parseInt(process.env.DAILY_TOKEN_BUDGET || "9500000"); // buffer under 10M
let budgetExceeded = false;

async function checkAndReserveBudget(estimatedTokens) {
  if (!openai) return true;
  const { data, error } = await supabase.rpc("increment_token_usage", {
    p_date: new Date().toISOString().slice(0, 10),
    p_tokens: estimatedTokens
  });
  if (error) {
    console.error(`[!] Token budget check failed, proceeding without guard: ${error.message}`);
    return true;
  }
  if (data > DAILY_TOKEN_BUDGET) {
    console.warn(`[BUDGET] Daily token budget (${DAILY_TOKEN_BUDGET}) exceeded (${data}). Stopping run early.`);
    budgetExceeded = true;
    return false;
  }
  return true;
}


async function classifyWithLLM(code, reviews, positiveRatio) {
  const merged = reviews
    .map(r => r.text.trim())
    .join("\n---\n")
    .slice(0, 6000); 

  const estimatedTokens = Math.ceil((merged.length + 800) / 4) + 750; 
  const budget = await checkAndReserveBudget(estimatedTokens);
  if (!budget) throw new Error("Daily token budget exceeded");

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You analyse anonymous student reviews of a single NUS university module. " +
          "Judge overall workload, difficulty, and typical grade outcome using ONLY what " +
          "the reviews actually say — do not invent detail. A DistilBERT positive-sentiment " +
          "ratio is provided as a supporting signal, not a rule to follow blindly; weigh it " +
          "against what the reviews actually describe. Extract up to 3 concise, actionable " +
          "tips students gave (paraphrase, don't quote verbatim).\n\n" +
          "For workload_score and difficulty_score: these represent HOW FAR toward the low or " +
          "high end of the chosen category this module sits, NOT how confident you are in the " +
          "label. For example, if workload_level is \"Light Workload\", a score near 0 means an " +
          "extremely minimal/easy workload, while a score near 1 means still light but at the " +
          "upper edge of what counts as light. Do NOT use these scores to express confidence in " +
          "the label itself — always pick the level you are most confident in, and use the " +
          "score purely to place it within that level's range.\n\n" +
          "Additionally perform aspect-based sentiment analysis: for each of lectures, " +
          "assignments, exams, group_projects, content_difficulty, staff_teaching, " +
          "workload_balance, and tutorials, include an entry ONLY if reviews give clear " +
          "evidence about it — do not force an opinion on aspects nobody mentioned.\n\n" +
          "Extract key info if mentioned: estimated hours/week of work (null if unstated), " +
          "exam format, and whether provided readings were described as helpful.\n\n" +
          "NUS students use the term \"fluff\" or \"fluff mod\" to describe a module with a " +
          "very light workload, often taken mainly to fulfil a core curriculum/breadth " +
          "requirement rather than genuine interest in the subject. If reviews use this term, " +
          "or describe the module this way (e.g. \"easy A\", \"just here to clear GE requirement\"), " +
          "set is_fluff_mod to true and weigh this toward a Light Workload rating. If reviews " +
          "give no indication either way, set is_fluff_mod to null — don't guess.\n\n" +
          "Extract any actionable suggestions students made for how the module could improve, " +
          "categorised as teaching_style, resource_request, assessment_feedback, " +
          "workload_adjustment, or other. Omit this if reviews contain no such suggestions.\n\n" +
          "Extract any professor/lecturer/instructor names actually given by name in the " +
          "reviews. Do NOT guess or infer a name from vague references like \"the prof\" or " +
          "initials alone — only include someone if a real name is stated.\n\n" +
          "Name formatting: return ONLY the bare name, with no honorific or title prefix " +
          "(no \"Prof.\", \"Dr.\", \"A/P\", \"Mr\", \"Ms\", \"Mdm\" etc.) — e.g. return \"Aditya\" not " +
          "\"Prof. Aditya\".\n\n" +
          "Consolidation: reviews may refer to the same person inconsistently — a full name in " +
          "one review, a nickname or shortened/partial version in another (e.g. \"Aditya\" and " +
          "\"Adi\" and \"Adhy\" could all be the same lecturer). You are given ALL of this " +
          "module's reviews together, so cross-reference them: if context (same semester, same " +
          "teaching style described, no indication of a second instructor) suggests two names " +
          "refer to the same person, merge them into ONE entry using the fullest/most complete " +
          "name given anywhere in the reviews, and sum their mention counts together. Only keep " +
          "them as separate entries if reviews give a real reason to believe they are different " +
          "people (e.g. explicitly described as co-teaching, or clearly different semesters with " +
          "no name overlap). When genuinely unsure whether two names are the same person, prefer " +
          "merging over duplicating — a review page listing the same lecturer twice is more " +
          "confusing than one that occasionally over-merges.\n\n" +
          "Reviews often mention which semester they took the module in (e.g. \"sem 1\", " +
          "\"semester 2\") near the professor's name; attach that semester to that professor if " +
          "it's clearly linked, otherwise use \"Unclear\". For mention_count, count how many of " +
          "the given reviews reference that same (merged) professor for that semester — minimum 1."
      },
      {
        role: "user",
        content: `Module: ${code}\nDistilBERT positive-review ratio: ${positiveRatio.toFixed(2)}\n\nReviews:\n${merged}`
      }
    ],
    response_format: { type: "json_schema", json_schema: ANALYSIS_SCHEMA }
  });

  const actualTokens = completion.usage?.total_tokens ?? estimatedTokens;
  if (actualTokens !== estimatedTokens) {
    await checkAndReserveBudget(actualTokens - estimatedTokens);
  }

  return JSON.parse(completion.choices[0].message.content);
}

//for testing purposes
const args = process.argv.slice(2);
const codesArg = args.find((a) => a.startsWith("--codes="))?.slice(8);
// `node analyser.mjs --all` force runs everything
const FORCE_ALL = args.includes("--all");

async function fetchAllRows(table, selectCols, applyFilters) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(selectCols);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed fetching ${table} at offset ${from}: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

async function runAnalysis() {
  console.log("Scanning database for new reviews");

  const rawReviews = await fetchAllRows("reviews", "module_code, scraped_at");
  console.log(`Reviews fetched: ${rawReviews.length} rows`);

  const reviewTimeMap = {};
  rawReviews.forEach(r => {
    if (!reviewTimeMap[r.module_code] || r.scraped_at > reviewTimeMap[r.module_code]) {
      reviewTimeMap[r.module_code] = r.scraped_at;
    }
  });

  const sentiments = await fetchAllRows("sentiment", "module_code, workload_level, last_scraped_at");
  const sentimentTimeMap = {};
  sentiments?.forEach(s => { 
    sentimentTimeMap[s.module_code] = s.workload_level === 'No data' ? null : s.last_scraped_at; 
  });

  const targetCodes = codesArg
    ? codesArg.split(",").map((c) => c.trim().toUpperCase())
    : FORCE_ALL
    ? (console.log("[MASTER CONTROL] --all flag set — re-analysing every module with reviews."),
       Object.keys(reviewTimeMap))
    : Object.keys(reviewTimeMap).filter(code => {
        const lastAnalysedTime = sentimentTimeMap[code];
        if (!lastAnalysedTime) return true;
        return reviewTimeMap[code] > lastAnalysedTime;
      });

  if (targetCodes.length === 0) {
    console.log("No updates needed");
    return;
  }


  let successCount = 0;
  let failCount = 0;

  for (const code of targetCodes) {
    if (budgetExceeded) {
      console.log(`[BUDGET] Stopping — ${targetCodes.length - successCount - failCount} modules deferred to next run.`);
      break;
    }
    try {
      console.log(`Recalculating: ${code}`);

      const { data: reviews, error: fetchError } = await supabase
        .from("reviews")
        .select("id, text")
        .eq("module_code", code);

      if (fetchError) {
        console.error(`  [FAIL] Could not fetch reviews for ${code}: ${fetchError.message}`);
        failCount++;
        continue;
      }

      if (!reviews || reviews.length === 0) {
        console.log(`  [OK] No reviews for ${code} — placeholder set`);
        await supabase
          .from("sentiment")
          .update({
            workload_level: 'No data yet',
            difficulty_level: 'No data yet',
            grade_level: 'No dat yet',
            last_scraped_at: new Date().toISOString()
          })
          .eq("module_code", code);
        successCount++;
        continue;
      }

      let positiveCount = 0;
      const tips = [];
      const reviewScores = []; //  score normalised -> 0 (very negative), 1 (very positive)

      for (const r of reviews) {
        const textSample = r.text.slice(0, 1000);
        const out = await classifier(textSample);
        const isPositive = out[0].label === "POSITIVE";
        if (isPositive) positiveCount++;

        const normalisedScore = isPositive ? out[0].score : 1 - out[0].score;
        reviewScores.push({ id: r.id, label: out[0].label, score: normalisedScore });

        if (r.text.toLowerCase().includes("tip") || r.text.toLowerCase().includes("recommend")) {
          const sentences = r.text.split(/[.!?\n]/);
          const tipSentence = sentences.find(s => s.toLowerCase().includes("tip") || s.toLowerCase().includes("recommend"));
          if (tipSentence && tipSentence.trim().length > 15 && tips.length < 3) {
            tips.push(tipSentence.trim().replace(/^[-★\s•]+/, ""));
          }
        }
      }

      const positiveRatio = positiveCount / reviews.length;

      const avgScore = reviewScores.reduce((sum, r) => sum + r.score, 0) / reviewScores.length;
      const OUTLIER_THRESHOLD = 0.4;
      await Promise.all(reviewScores.map(r =>
        supabase.from("reviews").update({
          sentiment_label: r.label,
          sentiment_score: r.score,
          is_outlier: Math.abs(r.score - avgScore) > OUTLIER_THRESHOLD
        }).eq("id", r.id)
      ));

      let llmResult = null;
      if (openai) {
        try {
          llmResult = await classifyWithLLM(code, reviews, positiveRatio);
        } catch (llmErr) {
          console.error(`  [LLM FAIL] ${code} — falling back to heuristic: ${llmErr.message}`);
        }
      }

      let sentimentPayload;

      if (llmResult) {
        sentimentPayload = {
          module_code: code,
          review_count: reviews.length,
          workload_level: llmResult.workload_level,
          workload_score: remapScoreToBand(llmResult.workload_level, llmResult.workload_score, WORKLOAD_SCORE_BANDS),
          workload_desc: llmResult.workload_desc,
          difficulty_level: llmResult.difficulty_level,
          difficulty_score: remapScoreToBand(llmResult.difficulty_level, llmResult.difficulty_score, DIFFICULTY_SCORE_BANDS),
          difficulty_desc: llmResult.difficulty_desc,
          grade_level: llmResult.grade_level,
          grade_score: positiveRatio,
          grade_desc: llmResult.grade_desc,
          tips: llmResult.tips.length > 0 ? llmResult.tips : ["No specific tips, make sure to be consistent in your revisions"],
          last_scraped_at: new Date().toISOString()
        };
      } else {
        const fullTextMerged = reviews.map(r => r.text).join(" ").toLowerCase();

        const heavyWorkload = (fullTextMerged.match(/heavy|project|time consuming|murder/g) || []).length >
                              (fullTextMerged.match(/light|easy|chill|fluff/g) || []).length;
        const highDifficulty = (fullTextMerged.match(/hard|difficult|abstract|mindblown/g) || []).length >
                              (fullTextMerged.match(/easy|straightforward|understandable/g) || []).length;

        sentimentPayload = {
          module_code: code,
          review_count: reviews.length,
          workload_level: heavyWorkload ? "Heavy Workload" : "Moderate Workload",
          workload_score: remapScoreToBand(heavyWorkload ? "Heavy Workload" : "Moderate Workload", 0.5, WORKLOAD_SCORE_BANDS),
          workload_desc: heavyWorkload ? "Be prepared to allocate extra time" : "Breeze but dont be complacent!",
          difficulty_level: highDifficulty ? "Challenging" : "Adequate",
          difficulty_score: remapScoreToBand(highDifficulty ? "Challenging" : "Adequate", 0.5, DIFFICULTY_SCORE_BANDS),
          difficulty_desc: highDifficulty ? "Complex topics taught that requires deep analytical thinking" : "Content is relatively easy to grasp",
          grade_level: positiveRatio > 0.6 ? "B+ or Higher" : "B / B- Average",
          grade_score: positiveRatio,
          grade_desc: "Average grade based on reviews below",
          tips: tips.length > 0 ? tips : ["No specific tips, make sure to be consistent in your revisions"],
          last_scraped_at: new Date().toISOString()
        };
      }

      const { error: upsertError } = await supabase.from("sentiment").upsert(sentimentPayload, { onConflict: 'module_code' });

      if (upsertError) {
        console.error(`  [FAIL] Upsert error for ${code}: ${upsertError.message}`);
        failCount++;
      } else {
        console.log(`  [OK] ${code} -> workload=${sentimentPayload.workload_level}, difficulty=${sentimentPayload.difficulty_level}, grade=${sentimentPayload.grade_level}`);
        successCount++;
      }

      if (llmResult) {
        await supabase.from("module_aspects").delete().eq("module_code", code);
        if (llmResult.aspects.length > 0) {
          const { error: aspectsError } = await supabase.from("module_aspects").insert(
            llmResult.aspects.map(a => ({
              module_code: code,
              aspect: a.aspect,
              sentiment: a.sentiment,
              note: a.note
            }))
          );
          if (aspectsError) console.error(`  [FAIL] module_aspects insert for ${code}: ${aspectsError.message}`);
        }

        const { error: keyInfoError } = await supabase.from("module_key_info").upsert({
          module_code: code,
          estimated_hours_per_week: llmResult.key_info.estimated_hours_per_week,
          exam_format: llmResult.key_info.exam_format,
          readings_helpful: llmResult.key_info.readings_helpful,
          is_fluff_mod: llmResult.key_info.is_fluff_mod,
          analysed_at: new Date().toISOString()
        }, { onConflict: 'module_code' });
        if (keyInfoError) console.error(`  [FAIL] module_key_info upsert for ${code}: ${keyInfoError.message}`);

        await supabase.from("module_suggestions").delete().eq("module_code", code);
        if (llmResult.suggestions.length > 0) {
          const { error: suggestionsError } = await supabase.from("module_suggestions").insert(
            llmResult.suggestions.map(s => ({
              module_code: code,
              category: s.category,
              suggestion: s.suggestion
            }))
          );
          if (suggestionsError) console.error(`  [FAIL] module_suggestions insert for ${code}: ${suggestionsError.message}`);
        }

        await supabase.from("module_professors").delete().eq("module_code", code);
        if (llmResult.professors.length > 0) {
          const stripHonorific = (name) =>
            name.replace(/^(prof\.?|dr\.?|a\/p|assoc\.?\s*prof\.?|mr\.?|mrs\.?|ms\.?|mdm\.?)\s+/i, "").trim();

          const merged = new Map();
          for (const p of llmResult.professors) {
            const cleanName = stripHonorific(p.name);
            const key = `${cleanName.toLowerCase()}|${p.semester}`;
            if (merged.has(key)) {
              merged.get(key).mention_count += p.mention_count;
            } else {
              merged.set(key, { name: cleanName, semester: p.semester, mention_count: p.mention_count });
            }
          }

          const { error: professorsError } = await supabase.from("module_professors").insert(
            Array.from(merged.values()).map(p => ({
              module_code: code,
              professor_name: p.name,
              semester: p.semester,
              mention_count: p.mention_count
            }))
          );
          if (professorsError) console.error(`  [FAIL] module_professors insert for ${code}: ${professorsError.message}`);
        }
      }

    } catch (err) {
      console.error(`  [CRITICAL] Unexpected error on ${code}, skipping: ${err.message}`);
      failCount++;
    }

    if (global.gc) global.gc();
  }

    console.log(`Analysis complete. ${successCount} succeeded, ${failCount} failed, out of ${targetCodes.length} total.`);
  }

runAnalysis();