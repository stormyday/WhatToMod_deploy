import { supabase } from "../supabaseClient";

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

export type AspectName =
  | "lectures" | "assignments" | "exams" | "group_projects"
  | "content_difficulty" | "staff_teaching" | "workload_balance" | "tutorials";

export type AspectSentiment = "positive" | "negative" | "mixed" | "neutral";

export interface ModuleAspectInsight {
  aspect: AspectName;
  sentiment: AspectSentiment;
  note: string | null;
}

export type ExamFormat =
  | "open_book" | "closed_book" | "take_home" | "proctored_online" | "no_exam" | "unclear";

export type ReadingsHelpful = "helpful" | "not_helpful" | "mixed" | "not_mentioned";

export interface ModuleKeyInfo {
  estimatedHoursPerWeek: number | null;
  examFormat: ExamFormat;
  readingsHelpful: ReadingsHelpful;
  isFluffMod: boolean | null;
}

export type SuggestionCategory =
  | "teaching_style" | "resource_request" | "assessment_feedback" | "workload_adjustment" | "other";

export interface ModuleSuggestion {
  category: SuggestionCategory;
  suggestion: string;
}

export type ProfessorSemester =
  | "Semester 1" | "Semester 2" | "Special Term I" | "Special Term II" | "Unclear";

export interface ProfessorMention {
  name: string;
  semester: ProfessorSemester;
  mentionCount: number;
}

export interface ModuleAPIResponse {
  module: NUSModuleDetail;
  reviews: Review[];
  sentiment: SentimentSummary;
  moduleAspects: ModuleAspectInsight[];
  keyInfo: ModuleKeyInfo | null;
  suggestions: ModuleSuggestion[];
  professors: ProfessorMention[];
}


let _moduleListCache: ModuleCondensed[] | null = null;

export async function fetchModuleList(): Promise<ModuleCondensed[]> {
  if (_moduleListCache) return _moduleListCache;

  const res = await fetch(
    "https://api.nusmods.com/v2/2025-2026/moduleList.json"
  );
  if (!res.ok) throw new Error("Failed to fetch module list from NUSMods");

  const data = await res.json();
  _moduleListCache = data;
  return data;
}

export async function fetchModuleDetail(code: string): Promise<NUSModuleDetail> {
  const res = await fetch(
    `https://api.nusmods.com/v2/2025-2026/modules/${code.toUpperCase()}.json`
  );
  if (res.status === 404) throw new Error(`Module ${code} not found`);
  if (!res.ok) throw new Error("Failed to fetch module from NUSMods");
  return res.json();
}

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
    workload:      { label: "Workload",       level: "No data", score: 0, descriptor: "No reviews yet" },
    difficulty:    { label: "Difficulty",     level: "No data", score: 0, descriptor: "No reviews yet" },
    expectedGrade: { label: "Expected grade", level: "No data", score: 0, descriptor: "No reviews yet" },
    overallVibe:   { label: "Overall vibe",   level: "No data", score: 0, descriptor: "No reviews yet" },
    tips: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchModuleAspects(code: string): Promise<ModuleAspectInsight[]> {
  const { data, error } = await supabase
    .from("module_aspects")
    .select("aspect, sentiment, note")
    .eq("module_code", code.toUpperCase());

  if (error) {
    console.error("[api] Error fetching module aspects:", error.message);
    return [];
  }

  return (data ?? []) as ModuleAspectInsight[];
}

export async function fetchKeyInfo(code: string): Promise<ModuleKeyInfo | null> {
  const { data, error } = await supabase
    .from("module_key_info")
    .select("*")
    .eq("module_code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("[api] Error fetching key info:", error.message);
    return null;
  }

  return {
    estimatedHoursPerWeek: data.estimated_hours_per_week,
    examFormat: data.exam_format,
    readingsHelpful: data.readings_helpful,
    isFluffMod: data.is_fluff_mod,
  };
}

export async function fetchSuggestions(code: string): Promise<ModuleSuggestion[]> {
  const { data, error } = await supabase
    .from("module_suggestions")
    .select("category, suggestion")
    .eq("module_code", code.toUpperCase());

  if (error) {
    console.error("[api] Error fetching module suggestions:", error.message);
    return [];
  }

  return (data ?? []) as ModuleSuggestion[];
}

export async function fetchProfessors(code: string): Promise<ProfessorMention[]> {
  const { data, error } = await supabase
    .from("module_professors")
    .select("professor_name, semester, mention_count")
    .eq("module_code", code.toUpperCase())
    .order("mention_count", { ascending: false });

  if (error) {
    console.error("[api] Error fetching professors:", error.message);
    return [];
  }

  return (data ?? []).map((p) => ({
    name: p.professor_name,
    semester: p.semester ?? "Unclear",
    mentionCount: p.mention_count,
  }));
}

export interface ProfessorModuleMention {
  moduleCode: string;
  semesters: string[];
  mentionCount: number;
}

export interface ProfessorRelatedMention {
  name: string;
  moduleCode: string;
  semesters: ProfessorSemester[];
  mentionCount: number;
}

export interface ProfessorProfile {
  name: string;
  modules: ProfessorModuleMention[];
  relatedModules: ProfessorRelatedMention[];
  reviewMentions: Review[];
}

function groupRelatedMentions(
  rows: { name: string; moduleCode: string; semester: ProfessorSemester; mentionCount: number }[]
): ProfessorRelatedMention[] {
  const map = new Map<string, ProfessorRelatedMention>();
  for (const r of rows) {
    const key = `${r.name.toLowerCase()}|${r.moduleCode}`;
    const existing = map.get(key);
    if (existing) {
      existing.mentionCount += r.mentionCount;
      if (!existing.semesters.includes(r.semester)) existing.semesters.push(r.semester);
    } else {
      map.set(key, { name: r.name, moduleCode: r.moduleCode, semesters: [r.semester], mentionCount: r.mentionCount });
    }
  }
  return [...map.values()].sort((a, b) => b.mentionCount - a.mentionCount);
}

export async function fetchProfessorReviewMentions(name: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .ilike("text", `%${name}%`)
    .order("scraped_at", { ascending: false });

  if (error) {
    console.error("[api] Error fetching professor review mentions:", error.message);
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

const PROFESSOR_MENTION_COLUMNS = "professor_name, module_code, semester, mention_count";

export async function fetchProfessorProfile(name: string, fromModuleCode?: string): Promise<ProfessorProfile> {
  const term = name.trim();
  const target = term.toLowerCase();

  const [containsRes, reviewMentions] = await Promise.all([
    term.length >= 3
      ? supabase.from("module_professors").select(PROFESSOR_MENTION_COLUMNS).ilike("professor_name", `%${term}%`).limit(2000)
      : Promise.resolve({ data: [], error: null }),
    fetchProfessorReviewMentions(term),
  ]);

  if (containsRes.error) console.error("[api] Error fetching related professor mentions:", containsRes.error.message);

  const moduleMentionCounts = new Map<string, number>();
  const moduleSemesters = new Map<string, Set<string>>();
  for (const r of reviewMentions) {
    moduleMentionCounts.set(r.moduleCode, (moduleMentionCounts.get(r.moduleCode) ?? 0) + 1);
    if (r.semester) {
      if (!moduleSemesters.has(r.moduleCode)) moduleSemesters.set(r.moduleCode, new Set());
      moduleSemesters.get(r.moduleCode)!.add(r.semester);
    }
  }

  if (fromModuleCode && !moduleMentionCounts.has(fromModuleCode)) {
    moduleMentionCounts.set(fromModuleCode, 0);
  }

  const modules: ProfessorModuleMention[] = [...moduleMentionCounts.entries()]
    .map(([moduleCode, mentionCount]) => {
      const semesters = moduleSemesters.get(moduleCode);
      return {
        moduleCode,
        semesters: semesters && semesters.size > 0 ? [...semesters] : ["Unclear"],
        mentionCount,
      };
    })
    .sort((a, b) => b.mentionCount - a.mentionCount);

  const relatedRows = (containsRes.data ?? [])
    .filter((p) => p.professor_name.toLowerCase().trim() !== target)
    .map((p) => ({
      name: p.professor_name,
      moduleCode: p.module_code,
      semester: (p.semester ?? "Unclear") as ProfessorSemester,
      mentionCount: p.mention_count,
    }));

  const confirmedCodes = new Set(modules.map((m) => m.moduleCode));
  const relatedModules = groupRelatedMentions(relatedRows).filter((m) => !confirmedCodes.has(m.moduleCode));

  return { name, modules, relatedModules, reviewMentions };
}

export async function fetchModule(code: string): Promise<ModuleAPIResponse> {
  const [module, reviews, sentiment, moduleAspects, keyInfo, suggestions, professors] = await Promise.all([
    fetchModuleDetail(code),
    fetchReviews(code),
    fetchSentiment(code),
    fetchModuleAspects(code),
    fetchKeyInfo(code),
    fetchSuggestions(code),
    fetchProfessors(code),
  ]);

  return { module, reviews, sentiment, moduleAspects, keyInfo, suggestions, professors };
}