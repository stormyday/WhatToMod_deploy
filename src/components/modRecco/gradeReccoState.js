import { createContext, useContext } from 'react';
import { normalizeCatalogModuleCode } from '../../utils/userModuleRecords';

export const GradeReccoContext = createContext(new Map());

export function useGradeRecommendation(moduleCode) {
  const recommendationsByModule = useContext(GradeReccoContext);
  return recommendationsByModule.get(normalizeCatalogModuleCode(moduleCode)) ?? null;
}
