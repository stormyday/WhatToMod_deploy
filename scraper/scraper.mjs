import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { pipeline } from "@xenova/transformers";
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');

const args = process.argv.slice(2);
const codesArg = args.find((a) => a.startsWith("--codes="))?.slice(8);
const limitArg = args.find((a) => a.startsWith("--limit="))?.slice(8);
const LIMIT = limitArg ? parseInt(limitArg) : Infinity;

async function getModuleCodes() {
  if (codesArg) return codesArg.split(",").map((c) => c.trim().toUpperCase());
  const res = await fetch("https://api.nusmods.com/v2/2024-2025/moduleList.json");
  const list = await res.json();
  const codes = list.map((m) => m.moduleCode);
  return LIMIT !== Infinity ? codes.slice(0, LIMIT) : codes;
}

//scraping via disqus api, doesnt work on free plan
/*
async function scrapeModule(code) {
  const apiKey = process.env.DISQUS_API_KEY;

  const threadRes = await fetch(
    `https://disqus.com/api/3.0/threads/details.json?` +
    new URLSearchParams({ api_key: apiKey, forum: "nusmods", thread: `ident:${code}` })
  );
  const threadData = await threadRes.json();

  if (threadData.code !== 0) return [];
  const threadId = threadData.response.id;

  let reviews = [];
  let cursor = null;
  let hasNext = true;

  while (hasNext) {
    const params = new URLSearchParams({
      api_key: apiKey,
      thread: threadId,
      limit: 100,
      order: "asc",
      include: "approved",
      });

    if (cursor) params.set("cursor", cursor);

    try {
      const res = await fetch(`https://disqus.com/api/3.0/posts/list.json?${params}`);
      const data = await res.json();
      console.log(`Posts in response: ${data.response.length}, hasNext: ${data.cursor?.hasNext}`);
      console.log("API response:", JSON.stringify(data).slice(0, 500));

      if (data.code !== 0) {
        if (data.code == 2)  {
          break; //no reviews yet
        }
        console.error(`  [!] Disqus API error for ${code}:`, data.response);
        break;
      }

      for (const post of data.response) {
        //if (post.isDeleted || post.isSpam) continue;
        const text = (post.raw_message?.trim() || post.message?.replace(/<[^>]+>/g, "").trim());

        if (text && text.length > 10) {
          reviews.push({
            id: `${code}-disqus-${post.id}`,
            module_code: code,
            text,
            semester: "",
            scraped_at: new Date().toISOString()});
        }
      }

      hasNext = data.cursor?.hasNext ?? false;
      cursor = data.cursor?.next ?? null;

      if (hasNext) await new Promise(r => setTimeout(r, 200));

    } catch (fetchError) {
      console.error(`  [!] Network failure fetching Disqus data: ${fetchError.message}`);
      break;
    }
  }

  return reviews;
}
  */

//scraping via playwright
async function scrapeModule(page, code) {
  try {
    await page.goto(`https://nusmods.com/courses/${code}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const iframeElement = await page
      .waitForSelector("#disqus_thread iframe[src*='disqus.com']", { timeout: 10000 })
      .catch(() => null);
    if (!iframeElement) return [];

    const disqusFrame = await iframeElement.contentFrame();
    if (!disqusFrame) return [];

    await disqusFrame.waitForSelector(".post-message", { timeout: 8000 }).catch(() => null);

    // Click "Load more comments" until all posts are loaded
    let previousCount = 0;
    let stableRounds = 0;

    while (stableRounds < 3) {
      const loadMoreBtn = await disqusFrame.$('[data-role="more"]');

      if (loadMoreBtn && await loadMoreBtn.isVisible()) {
        await loadMoreBtn.click();
        await page.waitForTimeout(2500);
      } else {
        stableRounds++;
      }

      const currentCount = await disqusFrame.evaluate(() =>
        document.querySelectorAll(".post-message").length
      );

      if (currentCount === previousCount) {
        stableRounds++;
      } else {
        stableRounds = 0;
        previousCount = currentCount;
      }
    }

    const posts = await disqusFrame.evaluate(() =>
      Array.from(document.querySelectorAll(".post-message")).map((el, i) => ({
        id: i,
        text: el.innerText?.trim(),
      }))
    );

    return posts
      .filter((p) => p.text && p.text.length > 10)
      .map(({ id, text }) => ({
        id: `${code}-disqus-${id}`,
        module_code: code,
        text,
        semester: "",
        scraped_at: new Date().toISOString(),
      }));

  } catch (err) {
    console.error(`  [!] ${code}: ${err.message}`);
    return [];
  }
}

async function processAndPushData(code, reviews) {
  if (reviews.length === 0) return;

  await supabase.from("reviews").delete().eq("module_code", code);
  await supabase.from("sentiment").delete().eq("module_code", code);

  for (let i = 0; i < reviews.length; i += 100) {
    const batch = reviews.slice(i, i + 100);
    const { error } = await supabase.from("reviews").insert(batch);
    if (error) console.error(`  [!] Supabase Reviews Insert Error:`, error.message);
  }

  let positiveCount = 0;
  const tips = [];
  
  for (const r of reviews) {
    const textSample = r.text.slice(0, 1000); 
    const out = await classifier(textSample);
    const prediction = out[0]; 

    if (prediction.label === "POSITIVE") {
      positiveCount++;
    }

    if (r.text.toLowerCase().includes("tip") || r.text.toLowerCase().includes("recommend")) {
      const sentences = r.text.split(/[.!?\n]/);
      const tipSentence = sentences.find(s => s.toLowerCase().includes("tip") || s.toLowerCase().includes("recommend"));
      if (tipSentence && tipSentence.trim().length > 15 && tips.length < 3) {
        tips.push(tipSentence.trim().replace(/^[-★\s•]+/, ""));
      }
    }
  }

  const positiveRatio = reviews.length > 0 ? positiveCount / reviews.length : 0.5;
  
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
    
    tips: tips.length > 0 ? tips : ["No specific tips, make sure to be consistent in your revisions"]
  };


  const { error: summaryError } = await supabase.from("sentiment").insert(sentimentPayload);
  if (summaryError) console.error(`  [!] Summary DB Insert Error:`, summaryError.message);
}

const moduleCodes = await getModuleCodes();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});
const page = await context.newPage();

let scraped = 0;

for (const code of moduleCodes) {
  process.stdout.write(`[scraper] ${code}... `);
  const reviews = await scrapeModule(page, code);

  if (reviews.length > 0) {
    await processAndPushData(code, reviews);
    console.log(`${reviews.length} reviews processed & pushed to DB.`);
    scraped++;
  } else {
    console.log("no reviews found");
  }

  await new Promise((r) => setTimeout(r, 2000 + Math.random() * 1000));
}

await browser.close();
console.log(`\n[scraper] Done. ${scraped}/${moduleCodes.length} modules processed.`);