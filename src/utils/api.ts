import { supabase } from "../supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModuleCondensed {
  moduleCode: string;
  title: string;
  semesters: number[];
}

export interface LessonSlot {
  classNo: string;
  day: string;
  startTime: string;
  endTime: string;
  venue: string;
  lessonType: string;
  weeks: number[];
}

export interface SemesterData {
  semester: number;
  timetable: LessonSlot[];
  examDate?: string;
  examDuration?: number;
}

export interface NUSModuleDetail {
  moduleCode: string;
  title: string;
  description: string;
  moduleCredit: string;
  department: string;
  faculty: string;
  prerequisite?: string;
  preclusion?: string;
  corequisite?: string;
  workload?: string | number[];
  semesterData: SemesterData[];
  fulfillRequirements?: string[];
}

export interface Review {
  id: string;
  moduleCode: string;
  text: string;
  semester: string;
  scrapedAt: string;
}

export interface AspectScore {
  label: string;
  level: string;
  score: number;
  descriptor: string;
}

export interface SentimentSummary {
  moduleCode: string;
  reviewCount: number;
  workload: AspectScore;
  difficulty: AspectScore;
  expectedGrade: AspectScore;
  overallVibe: AspectScore;
  tips: string[];
  generatedAt: string;
}

export interface ModuleAPIResponse {
  module: NUSModuleDetail;
  reviews: Review[];
  sentiment: SentimentSummary;
}

// ─── Module list (from NUSMods API directly) ──────────────────────────────────

let _moduleListCache: ModuleCondensed[] | null = null;

export async function fetchModuleList(): Promise<ModuleCondensed[]> {
  if (_moduleListCache) return _moduleListCache;

  const res = await fetch(
    "https://api.nusmods.com/v2/2024-2025/moduleList.json"
  );
  if (!res.ok) throw new Error("Failed to fetch module list from NUSMods");

  const data = await res.json();
  _moduleListCache = data;
  return data;
}

// ─── Module detail (from NUSMods API directly) ────────────────────────────────

export async function fetchModuleDetail(code: string): Promise<NUSModuleDetail> {
  const res = await fetch(
    `https://api.nusmods.com/v2/2024-2025/modules/${code.toUpperCase()}.json`
  );
  if (res.status === 404) throw new Error(`Module ${code} not found`);
  if (!res.ok) throw new Error("Failed to fetch module from NUSMods");
  return res.json();
}

// ─── Reviews (from Supabase) ──────────────────────────────────────────────────

export async function fetchReviews(code: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("module_code", code.toUpperCase())
    .order("scraped_at", { ascending: false });

  if (error) {
    console.error("[api] Error fetching reviews:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    moduleCode: r.module_code,
    text: r.text,
    semester: r.semester ?? "",
    scrapedAt: r.scraped_at,
  }));
}

// ─── Sentiment (from Supabase) ────────────────────────────────────────────────

export async function fetchSentiment(code: string): Promise<SentimentSummary> {
  const { data, error } = await supabase
    .from("sentiment")
    .select("*")
    .eq("module_code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return emptyFallback(code);
  }

  return {
    moduleCode: data.module_code,
    reviewCount: data.review_count,
    workload: {
      label: "Workload",
      level: data.workload_level,
      score: data.workload_score,
      descriptor: data.workload_desc,
    },
    difficulty: {
      label: "Difficulty",
      level: data.difficulty_level,
      score: data.difficulty_score,
      descriptor: data.difficulty_desc,
    },
    expectedGrade: {
      label: "Expected grade",
      level: data.grade_level,
      score: data.grade_score,
      descriptor: data.grade_desc,
    },
    overallVibe: {
      label: "Overall vibe",
      level: data.vibe_level,
      score: data.vibe_score,
      descriptor: data.vibe_desc,
    },
    tips: data.tips ?? [],
    generatedAt: data.generated_at,
  };
}

function emptyFallback(moduleCode: string): SentimentSummary {
  return {
    moduleCode,
    reviewCount: 0,
    workload:      { label: "Workload",       level: "No data", score: 0, descriptor: "Reviews not scraped yet" },
    difficulty:    { label: "Difficulty",     level: "No data", score: 0, descriptor: "Reviews not scraped yet" },
    expectedGrade: { label: "Expected grade", level: "No data", score: 0, descriptor: "Reviews not scraped yet" },
    overallVibe:   { label: "Overall vibe",   level: "No data", score: 0, descriptor: "Reviews not scraped yet" },
    tips: [],
    generatedAt: new Date().toISOString(),
  };
}

// ─── Combined fetch (replaces the old /api/module/:code endpoint) ─────────────

export async function fetchModule(code: string): Promise<ModuleAPIResponse> {
  const [module, reviews, sentiment] = await Promise.all([
    fetchModuleDetail(code),
    fetchReviews(code),
    fetchSentiment(code),
  ]);

  return { module, reviews, sentiment };
}