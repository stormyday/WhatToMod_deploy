// src/hooks/useModuleSearch.ts
import { useState, useEffect, useCallback } from "react";
import {
  fetchModuleList,
  fetchModule,
  type ModuleCondensed,
  type ModuleAPIResponse,
} from "../utils/api";

export function useModuleSearch() {
  const [moduleList, setModuleList] = useState<ModuleCondensed[]>([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ModuleCondensed[]>([]);
  const [result, setResult] = useState<ModuleAPIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load full module list once on mount (for autocomplete)
  useEffect(() => {
    fetchModuleList()
      .then(setModuleList)
      .catch(() => console.warn("Could not load module list from backend"));
  }, []);

  // Filter suggestions whenever query changes
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const q = query.toUpperCase();
    const matches = moduleList
      .filter(
        (m) =>
          m.moduleCode.includes(q) ||
          m.title.toUpperCase().includes(q)
      )
      .slice(0, 8);
    setSuggestions(matches);
  }, [query, moduleList]);

  const loadModule = useCallback(async (code: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSuggestions([]);
    setQuery(code);

    try {
      const data = await fetchModule(code);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    setSuggestions,
    result,
    loading,
    error,
    loadModule,
  };
}