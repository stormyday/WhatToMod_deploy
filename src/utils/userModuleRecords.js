import { supabase } from '../supabaseClient';

export const GRADE_VALUES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D+', 'D', 'F'];

export const GRADE_POINTS = {
  'A+': 5.0, 'A': 5.0, 'A-': 4.5,
  'B+': 4.0, 'B': 3.5, 'B-': 3.0,
  'C+': 2.5, 'C': 2.0,
  'D+': 1.5, 'D': 1.0, 'F': 0.0,
};

export function calculateGradePointAverage(records = []) {
  let points = 0;
  let countedMcs = 0;
  let suMcs = 0;

  records.forEach((record) => {
    const moduleCredit = Number(record?.moduleCredit ?? record?.module_credit);
    if (!Number.isFinite(moduleCredit) || moduleCredit <= 0) return;
    if (record?.isSu ?? record?.is_su) {
      suMcs += moduleCredit;
      return;
    }

    const gradePoint = GRADE_POINTS[record?.grade];
    if (gradePoint === undefined) return;
    points += gradePoint * moduleCredit;
    countedMcs += moduleCredit;
  });

  return {
    cap: countedMcs > 0 ? points / countedMcs : null,
    countedMcs,
    suMcs,
  };
}

export function gradeFromGpa(cap) {
  if (!Number.isFinite(cap)) return null;
  if (cap >= 4.75) return 'A';
  if (cap >= 4.25) return 'A-';
  if (cap >= 3.75) return 'B+';
  if (cap >= 3.25) return 'B';
  if (cap >= 2.75) return 'B-';
  if (cap >= 2.25) return 'C+';
  if (cap >= 1.75) return 'C';
  if (cap >= 1.25) return 'D+';
  if (cap >= 0.5) return 'D';
  return 'F';
}

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

  return {
    moduleCode,
    grade: isSu ? null : grade,
    isSu,
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

export async function loadUserModuleRecords(userId, client = supabase) {
  if (!userId) return [];

  const { data, error } = await client
    .from('user_module_records')
    .select('module_code,grade,is_su,module_catalog(title,module_credit)')
    .eq('user_id', userId)
    .order('module_code');

  if (error) throw error;
  return normalizeRecordList(data ?? []);
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
