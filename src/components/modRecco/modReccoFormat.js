function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function formatConfidence(value) {
  const confidence = numberOrNull(value);
  return confidence === null ? null : `${(confidence * 100).toFixed(1)}%`;
}

export function formatSupport(ruleSupport, antecedentSupport) {
  const ruleCount = numberOrNull(ruleSupport);
  const antecedentCount = numberOrNull(antecedentSupport);
  if (ruleCount === null || antecedentCount === null) return null;
  return `${ruleCount.toLocaleString()} of ${antecedentCount.toLocaleString()} matching students`;
}

export function normalizeRecommendation(row = {}) {
  return {
    moduleCode: row.module_code ?? '',
    antecedentModules: Array.isArray(row.antecedent_module_codes)
      ? row.antecedent_module_codes.filter(Boolean)
      : [],
    overall: {
      confidence: numberOrNull(row.overall_confidence),
      antecedentSupport: numberOrNull(row.overall_antecedent_support),
      ruleSupport: numberOrNull(row.overall_rule_support),
    },
    sameMajor: {
      confidence: numberOrNull(row.same_major_confidence),
      antecedentSupport: numberOrNull(row.same_major_antecedent_support),
      ruleSupport: numberOrNull(row.same_major_rule_support),
    },
  };
}
