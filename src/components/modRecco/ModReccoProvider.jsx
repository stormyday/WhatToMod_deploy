import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { normalizeCatalogModuleCode } from '../../utils/userModuleRecords';
import { normalizeRecommendation } from './modReccoFormat';
import { ModReccoContext } from './modReccoState';

async function loadModuleRecommendations(limit = 12) {
  const { data, error } = await supabase.rpc('get_module_recommendations', { p_limit: limit });
  if (error) throw error;
  return (data ?? []).map(normalizeRecommendation);
}

export default function ModReccoProvider({ children }) {
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    let active = true;

    loadModuleRecommendations()
      .then((nextRecommendations) => {
        if (active) setRecommendations(nextRecommendations);
      })
      .catch((error) => {
        // Recommendations are supplementary. A missing batch run must not block ModTree.
        console.warn('Module recommendations are unavailable:', error);
        if (active) setRecommendations([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const recommendationsByModule = useMemo(() => {
    const next = new Map();
    recommendations.forEach((recommendation) => {
      const moduleCode = normalizeCatalogModuleCode(recommendation.moduleCode);
      if (moduleCode) next.set(moduleCode, recommendation);
    });
    return next;
  }, [recommendations]);

  return <ModReccoContext.Provider value={recommendationsByModule}>{children}</ModReccoContext.Provider>;
}
