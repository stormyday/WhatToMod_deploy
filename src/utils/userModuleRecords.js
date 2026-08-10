import { supabase } from '../supabaseClient';

export const GRADE_VALUES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D+', 'D', 'F'];

// Distinct from the unrelated `semester` field used elsewhere; order matters here since consumers rely on it for the GPA trend.
export const SEMESTERS = ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4s1', 'y4s2'];
export const SEMESTER_OPTIONS = SEMESTERS.map((s) => ({ value: s, label: s.toUpperCase() }));

export function normalizeCatalogModuleCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function normalizeUserModuleRecord(record = {}) {
  const moduleCode = normalizeCatalogModuleCode(record.moduleCode ?? record.module_code);
  const grade = typeof record.grade === 'string' && GRADE_VALUES.includes(record.grade)
    ? record.grade
    : null;
  const isSu = Boolean(record.isSu ?? record.is_su);
  const catalog = Array.isArray(record.module_catalog) ? record.module_catalog[0] : record.module_catalog;
  const rawCredit = record.moduleCredit ?? record.module_credit ?? catalog?.module_credit;
  const moduleCredit = rawCredit === null || rawCredit === undefined || rawCredit === ''
    ? null
    : Number(rawCredit);
  const rawSemester = record.semesterTaken ?? record.semester_taken;
  const semesterTaken = SEMESTERS.includes(rawSemester) ? rawSemester : null;

  return {
    moduleCode,
    grade: isSu ? null : grade,
    isSu,
    semesterTaken,
    title: catalog?.title ?? record.title ?? moduleCode,
    moduleCredit: Number.isFinite(moduleCredit) ? moduleCredit : null,
  };
}

export function normalizeRecordList(records = []) {
  const recordsByModuleCode = new Map();

  records.forEach((record) => {
    const normalized = normalizeUserModuleRecord(record);
    if (!normalized.moduleCode) return;
    recordsByModuleCode.set(normalized.moduleCode, normalized);
  });

  return [...recordsByModuleCode.values()].sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
}

export function validateRecordList(records = []) {
  const normalized = normalizeRecordList(records);
  const hasEmptyModule = records.some((record) => !normalizeCatalogModuleCode(record?.moduleCode ?? record?.module_code));
  const inputCodes = records
    .map((record) => normalizeCatalogModuleCode(record?.moduleCode ?? record?.module_code))
    .filter(Boolean);

  if (hasEmptyModule) {
    return { valid: false, message: 'Choose a module for every row or remove the empty row.' };
  }

  if (inputCodes.length !== normalized.length) {
    return { valid: false, message: 'Each module can only be added once.' };
  }

  return { valid: true, records: normalized };
}

// Plain filtered query against mod_prereq (the table that's actually kept fresh) rather than an FK embed, to avoid fighting any existing FK to the never-populated module_catalog.
export async function fetchModuleCredits(moduleCodes, client = supabase) {
  const codes = [...new Set(moduleCodes.map(normalizeCatalogModuleCode).filter(Boolean))];
  if (codes.length === 0) return new Map();

  const { data, error } = await client
    .from('mod_prereq')
    .select('module_code,title,module_credit')
    .in('module_code', codes);

  if (error) throw error;

  return new Map((data ?? []).map((row) => [row.module_code, row]));
}

export async function loadUserModuleRecords(userId, client = supabase) {
  if (!userId) return [];

  const { data, error } = await client
    .from('user_module_records')
    .select('module_code,grade,is_su,semester_taken')
    .eq('user_id', userId)
    .order('module_code');

  if (error) throw error;

  const rows = data ?? [];
  const credits = await fetchModuleCredits(rows.map((row) => row.module_code), client);

  return normalizeRecordList(
    rows.map((row) => ({ ...row, module_catalog: credits.get(row.module_code) ?? null }))
  );
}

export async function replaceUserModuleRecords(userId, records, client = supabase) {
  const validation = validateRecordList(records);
  if (!validation.valid) throw new Error(validation.message);

  const { data: existing, error: existingError } = await client
    .from('user_module_records')
    .select('module_code')
    .eq('user_id', userId);
  if (existingError) throw existingError;

  const nextRecords = validation.records.map((record) => ({
    user_id: userId,
    module_code: record.moduleCode,
    grade: record.grade,
    is_su: record.isSu,
    semester_taken: record.semesterTaken,
  }));
  const nextCodes = new Set(nextRecords.map((record) => record.module_code));
  const removedCodes = (existing ?? [])
    .map((record) => record.module_code)
    .filter((moduleCode) => !nextCodes.has(moduleCode));

  if (nextRecords.length > 0) {
    const { error } = await client
      .from('user_module_records')
      .upsert(nextRecords, { onConflict: 'user_id,module_code' });
    if (error) throw error;
  }

  if (removedCodes.length > 0) {
    const { error } = await client
      .from('user_module_records')
      .delete()
      .eq('user_id', userId)
      .in('module_code', removedCodes);
    if (error) throw error;
  }

  return validation.records;
}

export async function addBlankModuleRecords(userId, moduleCodes, client = supabase) {
  const requestedCodes = [...new Set(moduleCodes.map(normalizeCatalogModuleCode).filter(Boolean))];
  if (requestedCodes.length === 0) return { savedCodes: [], skippedCodes: [] };

  const { data: catalogueRows, error: catalogueError } = await client
    .from('module_catalog')
    .select('module_code')
    .in('module_code', requestedCodes);
  if (catalogueError) throw catalogueError;

  const savedCodes = (catalogueRows ?? []).map((row) => row.module_code);
  const savedCodeSet = new Set(savedCodes);
  const skippedCodes = requestedCodes.filter((moduleCode) => !savedCodeSet.has(moduleCode));

  if (savedCodes.length > 0) {
    const { error } = await client
      .from('user_module_records')
      .upsert(savedCodes.map((moduleCode) => ({
        user_id: userId,
        module_code: moduleCode,
        grade: null,
        is_su: false,
      })), { onConflict: 'user_id,module_code', ignoreDuplicates: true });
    if (error) throw error;
  }

  return { savedCodes, skippedCodes };
}
