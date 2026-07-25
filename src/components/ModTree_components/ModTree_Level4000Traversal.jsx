const NODE_KEY_PATHWAY = 'pathwayName';
const NODE_KEY_PILLAR = 'pillarName';
const NODE_KEY_MODULE = 'moduleName';

const GROUP_KIND_PATHWAY = 'pathway';
const GROUP_KIND_PILLAR = 'pillar';
const GROUP_KIND_MODULE = 'module';

const ACTIVE_TRACKS_STORE = new Map();
const ACTIVE_TRACKS_LISTENERS = new Set();
let ACTIVE_TRACKS_VERSION = 0;

function hasOwnKey(node, key) {
    return Boolean(node) && Object.prototype.hasOwnProperty.call(node, key);
}

function resolveNodeType(node) {
    const presentKeys = [];

    if (hasOwnKey(node, NODE_KEY_PATHWAY)) presentKeys.push(NODE_KEY_PATHWAY);
    if (hasOwnKey(node, NODE_KEY_PILLAR)) presentKeys.push(NODE_KEY_PILLAR);
    if (hasOwnKey(node, NODE_KEY_MODULE)) presentKeys.push(NODE_KEY_MODULE);

    const malformed = presentKeys.length > 1;

    if (presentKeys.includes(NODE_KEY_PATHWAY)) {
        return { type: GROUP_KIND_PATHWAY, key: NODE_KEY_PATHWAY, malformed, presentKeys };
    }

    if (presentKeys.includes(NODE_KEY_PILLAR)) {
        return { type: GROUP_KIND_PILLAR, key: NODE_KEY_PILLAR, malformed, presentKeys };
    }

    if (presentKeys.includes(NODE_KEY_MODULE)) {
        return { type: GROUP_KIND_MODULE, key: NODE_KEY_MODULE, malformed, presentKeys };
    }

    return { type: null, key: null, malformed: true, presentKeys };
}

function resolveLabel(node, type) {
    if (!node || typeof node !== 'object') {
        return 'Untitled requirement';
    }

    if (type === GROUP_KIND_PATHWAY) {
        return node.pathwayName ?? node.label ?? 'Untitled pathway';
    }

    if (type === GROUP_KIND_PILLAR) {
        return node.pillarName ?? node.label ?? 'Untitled requirement';
    }

    if (type === GROUP_KIND_MODULE) {
        return node.moduleName ?? node.label ?? node.id ?? 'Untitled module';
    }

    return node.label ?? node.moduleName ?? node.pillarName ?? node.pathwayName ?? 'Untitled requirement';
}

function toArrayOrNull(value) {
    return Array.isArray(value) ? value : null;
}

function cloneActiveTracks(activeTracks) {
    if (!activeTracks || typeof activeTracks !== 'object') {
        return {};
    }

    return { ...activeTracks };
}

function notifyActiveTracksListeners() {
    ACTIVE_TRACKS_VERSION += 1;
    ACTIVE_TRACKS_LISTENERS.forEach((listener) => {
        listener();
    });
}

function resolveActiveIndex(pathKey, itemCount, activeTracks) {
    if (itemCount <= 0) {
        return 0;
    }

    const storedIndex = Number(activeTracks?.[pathKey]);

    if (Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < itemCount) {
        return storedIndex;
    }

    return 0;
}

function createGroupAnalysis({
    kind,
    pathKey,
    nodes = [],
    hasError = false,
    message = null,
    complete = false,
    activeIndex = null,
    autoCollapsed = false,
}) {
    return {
        kind: 'group',
        groupType: kind,
        pathKey,
        nodes,
        hasError,
        message,
        complete,
        activeIndex,
        autoCollapsed,
    };
}

function createInvalidAnalysis(message, pathKey = 'root') {
    return {
        kind: 'invalid',
        groupType: null,
        pathKey,
        nodes: [],
        hasError: true,
        message,
        complete: false,
        activeIndex: null,
        autoCollapsed: false,
    };
}

function createEmptyAnalysis(message, pathKey = 'root') {
    return {
        kind: 'empty',
        groupType: null,
        pathKey,
        nodes: [],
        hasError: true,
        message,
        complete: false,
        activeIndex: null,
        autoCollapsed: false,
    };
}

function createMixedAnalysis(pathKey, nodes, message) {
    return {
        kind: 'mixed',
        groupType: null,
        pathKey,
        nodes,
        hasError: true,
        message,
        complete: false,
        activeIndex: null,
        autoCollapsed: false,
    };
}

function analyzeGroup(nodes, context) {
    const pathKey = context?.pathKey ?? 'root';
    const activeTracks = cloneActiveTracks(context?.activeTracks);

    if (!Array.isArray(nodes)) {
        return createInvalidAnalysis('Level 4000 pathway data is unavailable.', pathKey);
    }

    if (nodes.length === 0) {
        return createEmptyAnalysis('No data available for this requirement.', pathKey);
    }

    const childAnalyses = nodes.map((node, index) => analyzeNode(node, `${pathKey}.${index}`, context));
    const firstType = childAnalyses[0]?.type ?? null;
    const mixed = childAnalyses.some((child) => child.type !== firstType);

    if (mixed) {
        return createMixedAnalysis(pathKey, childAnalyses, 'Invalid pathway data — mixed node types.');
    }

    if (firstType === GROUP_KIND_PATHWAY) {
        const autoCollapsed = childAnalyses.length === 1;
        const activeIndex = autoCollapsed ? 0 : resolveActiveIndex(pathKey, childAnalyses.length, activeTracks);
        const activeChild = childAnalyses[activeIndex];
        const complete = Boolean(activeChild?.complete) && !childAnalyses.some((child) => child.malformed);

        return createGroupAnalysis({
            kind: GROUP_KIND_PATHWAY,
            pathKey,
            nodes: childAnalyses,
            hasError: childAnalyses.some((child) => child.hasError || child.malformed),
            complete,
            activeIndex,
            autoCollapsed,
        });
    }

    if (firstType === GROUP_KIND_PILLAR) {
        const complete = childAnalyses.length > 0
            && childAnalyses.every((child) => Boolean(child.complete))
            && !childAnalyses.some((child) => child.malformed);

        return createGroupAnalysis({
            kind: GROUP_KIND_PILLAR,
            pathKey,
            nodes: childAnalyses,
            hasError: childAnalyses.some((child) => child.hasError || child.malformed),
            complete,
        });
    }

    if (firstType === GROUP_KIND_MODULE) {
        const complete = childAnalyses.some((child) => Boolean(child.complete)) && !childAnalyses.some((child) => child.malformed);

        return createGroupAnalysis({
            kind: GROUP_KIND_MODULE,
            pathKey,
            nodes: childAnalyses,
            hasError: childAnalyses.some((child) => child.hasError || child.malformed),
            complete,
        });
    }

    return createMixedAnalysis(pathKey, childAnalyses, 'Invalid pathway data — unknown node type.');
}

function analyzeNode(node, pathKey, context) {
    const nodeType = resolveNodeType(node);
    const selectedMods = Array.isArray(context?.selectedMods) ? context.selectedMods : [];
    const hasChildren = hasOwnKey(node, 'children');
    const children = toArrayOrNull(node?.children);

    const base = {
        pathKey,
        type: nodeType.type,
        typeKey: nodeType.key,
        malformed: nodeType.malformed,
        presentKeys: nodeType.presentKeys,
        label: resolveLabel(node, nodeType.type),
        rawNode: node,
        childrenGroup: null,
        hasError: nodeType.malformed,
        complete: false,
        message: nodeType.malformed
            ? 'Malformed node detected. The data contains multiple type keys.'
            : null,
    };

    if (nodeType.type === GROUP_KIND_PATHWAY) {
        const childrenGroup = analyzeGroup(children, {
            ...context,
            pathKey,
        });

        return {
            ...base,
            complete: Boolean(childrenGroup.complete),
            hasError: base.hasError || childrenGroup.hasError || !hasChildren,
            message: base.message || (!hasChildren ? 'No data available for this requirement.' : null),
            childrenGroup,
        };
    }

    if (nodeType.type === GROUP_KIND_PILLAR) {
        const childrenGroup = analyzeGroup(children, {
            ...context,
            pathKey,
        });

        return {
            ...base,
            complete: Boolean(childrenGroup.complete),
            hasError: base.hasError || childrenGroup.hasError || !hasChildren,
            message: base.message || (!hasChildren ? 'No data available for this requirement.' : null),
            childrenGroup,
        };
    }

    if (nodeType.type === GROUP_KIND_MODULE) {
        const moduleId = typeof node?.id === 'string' ? node.id : null;
        const complete = Boolean(moduleId) && selectedMods.includes(moduleId);
        const hasUnexpectedChildren = hasChildren && children !== null && children.length > 0;

        return {
            ...base,
            complete,
            hasError: base.hasError || hasUnexpectedChildren || !moduleId,
            message: base.message
                || (!moduleId ? 'Module nodes must include a valid id.' : null)
                || (hasUnexpectedChildren ? 'Module nodes should not contain children.' : null),
        };
    }

    return {
        ...base,
        type: null,
        hasError: true,
        complete: false,
        message: 'Node is missing a pathway, pillar, or module type key.',
    };
}

export function analyzeLevel4000Pathway(nodeData, selectedMods = [], activeTracks) {
    if (!nodeData || typeof nodeData !== 'object') {
        return createInvalidAnalysis('Level 4000 pathway data is unavailable.');
    }

    const tracksSource = activeTracks === undefined
        ? getLevel4000ActiveTracks(nodeData.id)
        : activeTracks;
    const options = nodeData.options;

    return analyzeGroup(options, {
        pathKey: nodeData.id ?? 'root',
        selectedMods,
        activeTracks: tracksSource,
    });
}

export function getLevel4000ActiveTracks(moduleId) {
    if (!moduleId) {
        return {};
    }

    return cloneActiveTracks(ACTIVE_TRACKS_STORE.get(moduleId));
}

export function setLevel4000ActiveTracks(moduleId, activeTracks) {
    if (!moduleId) {
        return;
    }

    ACTIVE_TRACKS_STORE.set(moduleId, cloneActiveTracks(activeTracks));
    notifyActiveTracksListeners();
}

export function clearLevel4000ActiveTracks(moduleId) {
    if (!moduleId) {
        return;
    }

    ACTIVE_TRACKS_STORE.delete(moduleId);
    notifyActiveTracksListeners();
}

export function subscribeLevel4000ActiveTracks(listener) {
    ACTIVE_TRACKS_LISTENERS.add(listener);

    return () => {
        ACTIVE_TRACKS_LISTENERS.delete(listener);
    };
}

export function getLevel4000ActiveTracksVersion() {
    return ACTIVE_TRACKS_VERSION;
}
