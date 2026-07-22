import { supabase } from "../../supabaseClient";
import { fetchModuleDetail, fetchModuleList } from "../../utils/api";

const MODULE_COLUMNS =
  'id,label,description,majors,compulsory_for,or_group_id,is_pillar,is_single_module_pillar,pillar_label,is_level4000_pathway,options,"is_requirement_group","Requirements","RequirementsPillar"';

let modTreeRowsPromise = null;
let modTreeSearchCatalogPromise = null;
const moduleLookupCache = {};

function normalizeCode(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeTitle(node, fallbackCode) {
    return node?.label ?? node?.title ?? fallbackCode.toUpperCase();
}

function normalizeDescription(node) {
    return typeof node?.description === "string" ? node.description : "";
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
