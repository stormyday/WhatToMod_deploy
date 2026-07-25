import { createClient } from "@supabase/supabase-js";
import { pipeline } from "@xenova/transformers";
import { config } from "dotenv";

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');

//for testing purposes
const args = process.argv.slice(2);
const codesArg = args.find((a) => a.startsWith("--codes="))?.slice(8);

async function fetchAllRows(table, selectCols, applyFilters) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(selectCols);
    if (applyFilters) query = applyFilters(query);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`[!] Failed fetching ${table} at offset ${from}:`, error.message);
      break;
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
    try {
      console.log(`Recalculating: ${code}`);

      const { data: reviews, error: fetchError } = await supabase
        .from("reviews")
        .select("text")
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

      for (const r of reviews) {
        const textSample = r.text.slice(0, 1000);
        const out = await classifier(textSample);
        if (out[0].label === "POSITIVE") positiveCount++;

        if (r.text.toLowerCase().includes("tip") || r.text.toLowerCase().includes("recommend")) {
          const sentences = r.text.split(/[.!?\n]/);
          const tipSentence = sentences.find(s => s.toLowerCase().includes("tip") || s.toLowerCase().includes("recommend"));
          if (tipSentence && tipSentence.trim().length > 15 && tips.length < 3) {
            tips.push(tipSentence.trim().replace(/^[-★\s•]+/, ""));
          }
        }
      }

      const positiveRatio = positiveCount / reviews.length;
      const fullTextMerged = reviews.map(r => r.text).join(" ").toLowerCase();

      const heavyWorkload = (fullTextMerged.match(/heavy|project|time consuming|murder/g) || []).length >
                            (fullTextMerged.match(/light|easy|chill/g) || []).length;
      const highDifficulty = (fullTextMerged.match(/hard|difficult|abstract|mindblown/g) || []).length >
                            (fullTextMerged.match(/easy|straightforward|understandable/g) || []).length;

      const sentimentPayload = {
        module_code: code,
        review_count: reviews.length,
        workload_level: heavyWorkload ? "Heavy Workload" : "Moderate Workload",
        workload_score: heavyWorkload ? 0.85 : 0.45,
        workload_desc: heavyWorkload ? "Be prepared to allocate extra time" : "Breeze but dont be complacent!",
        difficulty_level: highDifficulty ? "Challenging" : "Adequate",
        difficulty_score: highDifficulty ? 0.90 : 0.40,
        difficulty_desc: highDifficulty ? "Complex topics taught that requires deep analytical thinking" : "Content is relatively easy to grasp",
        grade_level: positiveRatio > 0.6 ? "B+ or Higher" : "B / B- Average",
        grade_score: positiveRatio,
        grade_desc: "Average grade based on reviews below",
        tips: tips.length > 0 ? tips : ["No specific tips, make sure to be consistent in your revisions"],
        last_scraped_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabase.from("sentiment").upsert(sentimentPayload, { onConflict: 'module_code' });

      if (upsertError) {
        console.error(`  [FAIL] Upsert error for ${code}: ${upsertError.message}`);
        failCount++;
      } else {
        console.log(`  [OK] ${code} -> workload=${sentimentPayload.workload_level}, difficulty=${sentimentPayload.difficulty_level}, grade=${sentimentPayload.grade_level}`);
        successCount++;
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