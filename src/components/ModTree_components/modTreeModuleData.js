import { supabase } from "../../supabaseClient";
import { fetchModuleDetail, fetchModuleList } from "../../utils/api";

const MODULE_COLUMNS =
  'id,label,description,majors,compulsory_for,or_group_id,is_pillar,is_single_module_pillar,pillar_label,is_level4000_pathway,options,"is_requirement_group","Requirements","RequirementsPillar"';
const PREREQ_COLUMNS =
  'module_code,title,module_credit,department,faculty,prerequisite_raw,corequisite_raw,preclusion_raw,prereq_codes,coreq_codes,preclusion_codes,prereq_tree';

let modTreeRowsPromise = null;
let modTreeSearchCatalogPromise = null;
const moduleLookupCache = {};
const modulePrereqCache = {};

function normalizeCode(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeTitle(node, fallbackCode) {
    return node?.label ?? node?.title ?? fallbackCode.toUpperCase();
}

function normalizeDescription(node) {
    return typeof node?.description === "string" ? node.description : "";
}

function collectModuleCodes(value, collected) {
    if (!value) {
        return;
    }

    if (typeof value === "string") {
        const normalized = normalizeCode(value);
        if (normalized && /^[a-z]{2,4}\d{4}[a-z]?$/i.test(value.trim())) {
            collected.add(normalized);
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((entry) => collectModuleCodes(entry, collected));
        return;
    }

    if (typeof value === "object") {
        Object.values(value).forEach((entry) => collectModuleCodes(entry, collected));
    }
}

function parsePrereqTree(value) {
    if (typeof value !== "string") {
        return value ?? null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    try {
        return JSON.parse(trimmed);
    } catch {
        return value;
    }
}

function normalizePrereqLeafLabel(value) {
    if (typeof value !== "string") {
        return "";
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return "";
    }

    const normalized = normalizeCode(trimmed);
    return /^[a-z]{2,4}\d{4}[a-z]?$/i.test(trimmed) ? normalized.toUpperCase() : trimmed;
}

function normalizePrereqNode(node) {
    if (node === null || node === undefined) {
        return null;
    }

    if (typeof node === "string") {
        return { type: "leaf", value: node };
    }

    if (Array.isArray(node)) {
        return {
            type: "and",
            children: node.map(normalizePrereqNode).filter(Boolean),
        };
    }

    if (typeof node !== "object") {
        return { type: "leaf", value: String(node) };
    }

    if (Array.isArray(node.and)) {
        return {
            type: "and",
            children: node.and.map(normalizePrereqNode).filter(Boolean),
        };
    }

    if (Array.isArray(node.or)) {
        return {
            type: "or",
            children: node.or.map(normalizePrereqNode).filter(Boolean),
        };
    }

    if (typeof node.module === "string") {
        return { type: "leaf", value: node.module };
    }

    if (typeof node.moduleCode === "string") {
        return { type: "leaf", value: node.moduleCode };
    }

    if (typeof node.code === "string") {
        return { type: "leaf", value: node.code };
    }

    if (typeof node.value === "string") {
        return { type: "leaf", value: node.value };
    }

    return null;
}

function describePrereqNode(node) {
    const normalized = normalizePrereqNode(node);
    if (!normalized) {
        return "";
    }

    if (normalized.type === "leaf") {
        return normalizePrereqLeafLabel(normalized.value);
    }

    const separator = normalized.type === "or" ? " or " : " and ";
    const parts = normalized.children
        .map(describePrereqNode)
        .filter(Boolean);

    if (parts.length === 0) {
        return "";
    }

    const joined = parts.join(separator);
    return parts.length > 1 ? `(${joined})` : joined;
}

function evaluatePrereqNode(node, availableModuleCodes) {
    const normalized = normalizePrereqNode(node);

    if (!normalized) {
        return { satisfied: true, missing: [] };
    }

    if (normalized.type === "leaf") {
        const rawValue = typeof normalized.value === "string" ? normalized.value : "";
        const normalizedCode = normalizeCode(rawValue);
        const isModuleCode = /^[a-z]{2,4}\d{4}[a-z]?$/i.test(rawValue.trim());
        const satisfied = isModuleCode && availableModuleCodes.has(normalizedCode);

        return {
            satisfied,
            missing: satisfied ? [] : [normalizePrereqLeafLabel(rawValue)],
        };
    }

    if (normalized.type === "and") {
        const childResults = normalized.children.map((child) => evaluatePrereqNode(child, availableModuleCodes));
        return {
            satisfied: childResults.every((result) => result.satisfied),
            missing: childResults.flatMap((result) => result.missing),
        };
    }

    if (normalized.type === "or") {
        const childResults = normalized.children.map((child) => evaluatePrereqNode(child, availableModuleCodes));
        if (childResults.some((result) => result.satisfied)) {
            return { satisfied: true, missing: [] };
        }

        const description = describePrereqNode({ or: normalized.children });
        return {
            satisfied: false,
            missing: description ? [description] : [],
        };
    }

    return { satisfied: true, missing: [] };
}

export function getPrereqConflictMessages(prereqRow, availableModuleCodes = []) {
    const availableSet = new Set(
        (Array.isArray(availableModuleCodes) ? availableModuleCodes : [])
            .map(normalizeCode)
            .filter(Boolean)
    );

    if (prereqRow?.prereqTree) {
        return evaluatePrereqNode(prereqRow.prereqTree, availableSet).missing;
    }

    const prereqCodes = Array.isArray(prereqRow?.prereqCodes) ? prereqRow.prereqCodes : [];
    return prereqCodes
        .map(normalizeCode)
        .filter(Boolean)
        .filter((code) => !availableSet.has(code))
        .map((code) => code.toUpperCase());
}

function normalizeModTreeNode(node) {
    const moduleCode = normalizeCode(node?.id ?? node?.moduleCode);

    if (!moduleCode) {
        return null;
    }

    return {
        id: moduleCode,
        label: normalizeTitle(node, moduleCode),
        description: normalizeDescription(node),
        moduleCode,
        title: normalizeTitle(node, moduleCode),
        hasModTreeMetadata: true,
        source: "modtree",
    };
}

function normalizePrereqRow(row) {
    if (!row) {
        return null;
    }

    const moduleCode = normalizeCode(row.module_code);
    if (!moduleCode) {
        return null;
    }

    const prereqCodes = new Set(
        Array.isArray(row.prereq_codes) ? row.prereq_codes.map(normalizeCode).filter(Boolean) : []
    );
    if (prereqCodes.size === 0) {
        collectModuleCodes(row.prereq_tree, prereqCodes);
    }

    return {
        moduleCode,
        title: row.title ?? moduleCode.toUpperCase(),
        moduleCredit: row.module_credit ?? null,
        department: row.department ?? null,
        faculty: row.faculty ?? null,
        prerequisiteRaw: row.prerequisite_raw ?? null,
        corequisiteRaw: row.corequisite_raw ?? null,
        preclusionRaw: row.preclusion_raw ?? null,
        prereqCodes: [...prereqCodes],
        coreqCodes: Array.isArray(row.coreq_codes) ? row.coreq_codes.map(normalizeCode).filter(Boolean) : [],
        preclusionCodes: Array.isArray(row.preclusion_codes) ? row.preclusion_codes.map(normalizeCode).filter(Boolean) : [],
        prereqTree: parsePrereqTree(row.prereq_tree),
    };
}

function collectNodes(node, collected) {
    if (!node || typeof node !== "object") {
        return;
    }

    const normalized = normalizeModTreeNode(node);
    if (normalized && !collected.has(normalized.moduleCode)) {
        collected.set(normalized.moduleCode, normalized);
    }

    if (Array.isArray(node.children)) {
        node.children.forEach((child) => collectNodes(child, collected));
    }

    if (Array.isArray(node.options)) {
        node.options.forEach((option) => collectNodes(option, collected));
    }

    if (Array.isArray(node.RequirementsPillar)) {
        node.RequirementsPillar.forEach((pillar) => {
            collectNodes(pillar, collected);
            if (pillar && typeof pillar === "object" && Array.isArray(pillar.options)) {
                pillar.options.forEach((option) => collectNodes(option, collected));
            }
        });
    }
}

async function fetchModTreeRows() {
    if (!modTreeRowsPromise) {
        modTreeRowsPromise = supabase
            .from("modules")
            .select(MODULE_COLUMNS)
            .then(({ data, error }) => {
                if (error) {
                    console.error("[modtree] Error fetching module rows:", error.message);
                    return [];
                }

                return data ?? [];
            });
    }

    return modTreeRowsPromise;
}

async function fetchModulePrereqRow(moduleCode) {
    const key = normalizeCode(moduleCode);
    if (!key) {
        return null;
    }

    if (!modulePrereqCache[key]) {
        modulePrereqCache[key] = supabase
            .from("mod_prereq")
            .select(PREREQ_COLUMNS)
            .eq("module_code", key.toUpperCase())
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) {
                    console.error("[modtree] Error fetching module prereq row:", error.message);
                    return null;
                }

                return normalizePrereqRow(data);
            });
    }

    return modulePrereqCache[key];
}

async function buildModTreeSearchCatalog() {
    if (!modTreeSearchCatalogPromise) {
        modTreeSearchCatalogPromise = (async () => {
            const [rows, fallbackList] = await Promise.all([
                fetchModTreeRows(),
                fetchModuleList(),
            ]);

            const modulesByCode = new Map();

            rows.forEach((row) => {
                collectNodes(row, modulesByCode);
            });

            fallbackList.forEach((entry) => {
                const moduleCode = normalizeCode(entry.moduleCode);
                if (!moduleCode || modulesByCode.has(moduleCode)) {
                    return;
                }

                modulesByCode.set(moduleCode, {
                    moduleCode,
                    title: entry.title ?? moduleCode.toUpperCase(),
                    description: "",
                    hasModTreeMetadata: false,
                    source: "fallback",
                });
            });

            return [...modulesByCode.values()].sort((a, b) =>
                a.moduleCode.localeCompare(b.moduleCode)
            );
        })();
    }

    return modTreeSearchCatalogPromise;
}

function findNodeByCode(node, targetCode) {
    if (!node || typeof node !== "object") {
        return null;
    }

    const normalized = normalizeModTreeNode(node);
    if (normalized?.moduleCode === targetCode) {
        return normalized;
    }

    for (const key of ["children", "options"]) {
        if (!Array.isArray(node[key])) {
            continue;
        }

        for (const child of node[key]) {
            const match = findNodeByCode(child, targetCode);
            if (match) {
                return match;
            }
        }
    }

    if (Array.isArray(node.RequirementsPillar)) {
        for (const pillar of node.RequirementsPillar) {
            const match = findNodeByCode(pillar, targetCode);
            if (match) {
                return match;
            }

            if (pillar && typeof pillar === "object" && Array.isArray(pillar.options)) {
                for (const option of pillar.options) {
                    const nestedMatch = findNodeByCode(option, targetCode);
                    if (nestedMatch) {
                        return nestedMatch;
                    }
                }
            }
        }
    }

    return null;
}

export async function getModTreeSearchCatalog() {
    return buildModTreeSearchCatalog();
}

export function normalizeModuleCode(moduleCode) {
    return normalizeCode(moduleCode);
}

export async function lookupModuleMetadata(moduleCode) {
    const key = normalizeCode(moduleCode);
    if (!key) {
        return null;
    }

    if (moduleLookupCache[key]) {
        return moduleLookupCache[key];
    }

    const exactQuery = supabase
        .from("modules")
        .select(MODULE_COLUMNS)
        .eq("id", key)
        .maybeSingle();

    const [{ data, error }, rows] = await Promise.all([
        exactQuery,
        fetchModTreeRows(),
    ]);

    if (!error && data) {
        const normalized = normalizeModTreeNode(data);
        moduleLookupCache[key] = normalized;
        return normalized;
    }

    for (const row of rows ?? []) {
        const match = findNodeByCode(row, key);
        if (match) {
            moduleLookupCache[key] = match;
            return match;
        }
    }

    try {
        const detail = await fetchModuleDetail(key);
            const fallback = {
            id: normalizeCode(detail.moduleCode) || key,
            label: detail.title ?? key.toUpperCase(),
            description: detail.description ?? "",
            moduleCode: normalizeCode(detail.moduleCode) || key,
            title: detail.title ?? key.toUpperCase(),
            hasModTreeMetadata: false,
            source: "fallback",
        };

        moduleLookupCache[key] = fallback;
        return fallback;
    } catch (lookupError) {
        console.warn(`[modtree] Could not resolve module ${moduleCode}:`, lookupError);
        moduleLookupCache[key] = null;
        return null;
    }
}

export async function lookupModulePrereq(moduleCode) {
    return fetchModulePrereqRow(moduleCode);
}
