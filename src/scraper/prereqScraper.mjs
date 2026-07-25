import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const ACADEMIC_YEAR = '2026-2027';
const MODULE_LIST_URL = `https://api.nusmods.com/v2/${ACADEMIC_YEAR}/moduleList.json`;
const MODULE_DETAIL_URL = (moduleCode) =>
  `https://api.nusmods.com/v2/${ACADEMIC_YEAR}/modules/${moduleCode}.json`;
const BATCH_SIZE = 300;
const FETCH_CONCURRENCY = 20;

function loadEnvFile(filePath = '.env') {
  let currentDir = process.cwd();
  let fullPath = null;

  while (true) {
    const candidate = path.resolve(currentDir, filePath);
    if (fs.existsSync(candidate)) {
      fullPath = candidate;
      break;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  if (!fullPath) return;

  const contents = fs.readFileSync(fullPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^["']|["']$/g, '');

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) in environment.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const MODULE_CODE_REGEX = /[A-Z]{2,4}\d{4}[A-Z]?/g;
const MODULE_CODE_SUFFIX_REGEX = /:D$/i;

function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function extractModuleCodes(rawValue) {
  if (!rawValue) return [];

  const text = String(rawValue).toUpperCase();
  const matches = text.match(MODULE_CODE_REGEX) ?? [];
  return [...new Set(matches)];
}

function normalizePrereqTreeNode(node) {
  if (Array.isArray(node)) {
    return node.map((child) => normalizePrereqTreeNode(child));
  }

  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, normalizePrereqTreeNode(value)]),
    );
  }

  if (typeof node === 'string') {
    return node.replace(MODULE_CODE_SUFFIX_REGEX, '');
  }

  return node;
}

function normalizeRawText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeModuleRow(module, fallbackModuleCode = null) {
  return {
    module_code: module.moduleCode ?? module.module_code ?? fallbackModuleCode,
    title: module.title ?? null,
    module_credit: module.moduleCredit ?? module.module_credit ?? null,
    department: module.department ?? null,
    faculty: module.faculty ?? null,
    prerequisite_raw: normalizeRawText(module.prerequisite ?? module.prerequisites ?? module.prereq ?? null),
    corequisite_raw: normalizeRawText(module.corequisite ?? module.corequisites ?? null),
    preclusion_raw: normalizeRawText(module.preclusion ?? module.preclusions ?? null),
    prereq_codes: extractModuleCodes(module.prerequisite ?? module.prerequisites ?? module.prereq ?? ''),
    coreq_codes: extractModuleCodes(module.corequisite ?? module.corequisites ?? ''),
    preclusion_codes: extractModuleCodes(module.preclusion ?? module.preclusions ?? ''),
    prereq_tree: normalizePrereqTreeNode(module.prereqTree ?? module.prereq_tree ?? null),
  };
}

function normalizeModuleCodes(payload) {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) {
    return data
      .map((module) => module.moduleCode ?? module.module_code ?? module)
      .filter((moduleCode) => typeof moduleCode === 'string' && moduleCode.length > 0);
  }

  if (data && typeof data === 'object') {
    return Object.keys(data);
  }

  return [];
}

async function fetchModuleRows() {
  const moduleCodes = [...new Set(normalizeModuleCodes(await fetchJson(MODULE_LIST_URL)))];

  if (moduleCodes.length === 0) {
    return [];
  }

  const rows = [];
  for (let index = 0; index < moduleCodes.length; index += FETCH_CONCURRENCY) {
    const batchCodes = moduleCodes.slice(index, index + FETCH_CONCURRENCY);
    console.log(
      `Fetching module details ${index + 1}-${Math.min(index + FETCH_CONCURRENCY, moduleCodes.length)} of ${moduleCodes.length}...`,
    );

    const settled = await Promise.allSettled(
      batchCodes.map(async (moduleCode) => ({
        moduleCode,
        payload: await fetchJson(MODULE_DETAIL_URL(moduleCode)),
      })),
    );

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        rows.push(normalizeModuleRow(result.value.payload, result.value.moduleCode));
      } else {
        console.error('Failed to fetch module detail:', result.reason);
      }
    }
  }

  return rows;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchExistingModuleCodes(moduleCodes) {
  if (moduleCodes.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('mod_prereq')
    .select('module_code')
    .in('module_code', moduleCodes);

  if (error) {
    throw new Error(`Supabase lookup failed before upsert: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.module_code));
}

async function upsertBatch(rows, batchIndex, totalBatches) {
  const moduleCodes = rows.map((row) => row.module_code).filter(Boolean);
  const existingModuleCodes = await fetchExistingModuleCodes(moduleCodes);
  const existingCount = moduleCodes.filter((code) => existingModuleCodes.has(code)).length;
  const insertCount = moduleCodes.length - existingCount;

  console.log(
    `Upserting batch ${batchIndex + 1} of ${totalBatches} (${rows.length} rows, ${existingCount} updates, ${insertCount} inserts)...`,
  );

  const { error } = await supabase.from('mod_prereq').upsert(rows, {
    onConflict: 'module_code',
  });

  if (error) {
    throw new Error(`Supabase upsert failed for batch ${batchIndex + 1}: ${error.message}`);
  }

  console.log(`Batch ${batchIndex + 1} of ${totalBatches} upserted successfully.`);
}

async function main() {
  console.log(`Fetching NUSMods module data for ${ACADEMIC_YEAR}...`);
  const rows = (await fetchModuleRows()).filter((row) => row.module_code);

  if (rows.length === 0) {
    console.log('No modules returned from the API. Exiting.');
    return;
  }

  const batches = chunkArray(rows, BATCH_SIZE);
  console.log(`Prepared ${rows.length} modules in ${batches.length} batch(es).`);

  for (let index = 0; index < batches.length; index += 1) {
    await upsertBatch(batches[index], index, batches.length);
  }

  console.log(`Completed upsert for ${rows.length} modules into mod_prereq.`);
}

main().catch((error) => {
  console.error('NUSMods scrape failed:', error);
  process.exit(1);
});
