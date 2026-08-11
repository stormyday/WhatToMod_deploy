function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeGradeRecommendation(row = {}) {
  const referenceModuleCount = numberOrNull(row.reference_module_count);

  return {
    moduleCode: row.module_code ?? '',
    predictedGrade: row.predicted_grade ?? '',
    predictionSource: row.prediction_source ?? '',
    referenceModuleCount: referenceModuleCount === 1 || referenceModuleCount === 2
      ? referenceModuleCount
      : null,
    antecedentModules: Array.isArray(row.antecedent_module_codes)
      ? row.antecedent_module_codes.filter(Boolean)
      : [],
    confidence: numberOrNull(row.confidence),
    antecedentSupport: numberOrNull(row.antecedent_support),
    ruleSupport: numberOrNull(row.rule_support),
  };
}

export function formatGradeRecommendation(recommendation) {
  if (!recommendation?.predictedGrade) {
    return 'No prediction';
  }

  if (recommendation.predictionSource === 'gpa') {
    return `${recommendation.predictedGrade} (Based on GPA)`;
  }

  if (!recommendation.referenceModuleCount) return 'No prediction';

  return `${recommendation.predictedGrade} (${recommendation.referenceModuleCount}-module reference)`;
}
