import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  calculateGradePointAverage,
  gradeFromGpa,
  loadUserModuleRecords,
  normalizeCatalogModuleCode,
} from '../../utils/userModuleRecords';
import { normalizeGradeRecommendation } from './gradeReccoFormat';
import { GradeReccoContext } from './gradeReccoState';

const GRADE_RECOMMENDATION_RPC_BATCH_SIZE = 500;

function normalizeModuleCodes(moduleCodes = []) {
  return [...new Set(moduleCodes
    .map(normalizeCatalogModuleCode)
    .filter(Boolean))]
    .sort();
}

function batches(values, size) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadGradeRecommendations(moduleCodes, userId) {
  const [responses, records] = await Promise.all([
    Promise.all(batches(moduleCodes, GRADE_RECOMMENDATION_RPC_BATCH_SIZE).map(async (batch) => {
      const { data, error } = await supabase.rpc('get_grade_recommendations', {
        p_module_codes: batch,
      });
      if (error) throw error;
      return data ?? [];
    })),
    loadUserModuleRecords(userId),
  ]);
  const recommendationsByModule = new Map(
    responses.flat().map(normalizeGradeRecommendation).map((recommendation) => [recommendation.moduleCode, recommendation]),
  );
  const completedModuleCodes = new Set(records.filter((record) => Boolean(record.grade)).map((record) => record.moduleCode));
  const baseGrade = gradeFromGpa(calculateGradePointAverage(records).cap);

  if (baseGrade) {
    moduleCodes.forEach((moduleCode) => {
      if (!completedModuleCodes.has(moduleCode) && !recommendationsByModule.has(moduleCode)) {
        recommendationsByModule.set(moduleCode, normalizeGradeRecommendation({
          module_code: moduleCode,
          predicted_grade: baseGrade,
          prediction_source: 'gpa',
        }));
      }
    });
  }

  return [...recommendationsByModule.values()];
}

export default function GradeReccoProvider({ children, moduleCodes, userId, enabled = true }) {
  const [recommendations, setRecommendations] = useState([]);
  const normalizedModuleCodes = useMemo(() => normalizeModuleCodes(moduleCodes), [moduleCodes]);
  const moduleCodeKey = normalizedModuleCodes.join('|');

  useEffect(() => {
    let active = true;
    const requestModuleCodes = moduleCodeKey ? moduleCodeKey.split('|') : [];
    if (!enabled || requestModuleCodes.length === 0) {
      return () => { active = false; };
    }

    loadGradeRecommendations(requestModuleCodes, userId)
      .then((nextRecommendations) => {
        if (active) setRecommendations(nextRecommendations);
      })
      .catch((error) => {
        // Grade recommendations are supplementary and must never block ModTree.
        console.warn('Grade recommendations are unavailable:', error);
        if (active) setRecommendations([]);
      });

    return () => { active = false; };
  }, [enabled, moduleCodeKey, userId]);

  const recommendationsByModule = useMemo(() => {
    if (!enabled || !moduleCodeKey) return new Map();

    const next = new Map();
    recommendations.forEach((recommendation) => {
      const moduleCode = normalizeCatalogModuleCode(recommendation.moduleCode);
      if (moduleCode) next.set(moduleCode, recommendation);
    });
    return next;
  }, [enabled, moduleCodeKey, recommendations]);

  return <GradeReccoContext.Provider value={recommendationsByModule}>{children}</GradeReccoContext.Provider>;
}
