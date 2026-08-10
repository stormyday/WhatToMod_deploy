import { createContext, useContext } from 'react';
import { normalizeCatalogModuleCode } from '../../utils/userModuleRecords';

export const ModReccoContext = createContext(new Map());

export function useModuleRecommendation(moduleCode) {
  const recommendationsByModule = useContext(ModReccoContext);
  return recommendationsByModule.get(normalizeCatalogModuleCode(moduleCode)) ?? null;
}
