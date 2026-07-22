import { useEffect, useMemo, useRef, useState } from "react";
import { getModTreeSearchCatalog } from "../components/ModTree_components/modTreeModuleData";

function buildSuggestions(catalog, query) {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const q = trimmed.toUpperCase();
  return catalog
    .filter((module) => {
      const code = module.moduleCode.toUpperCase();
      const title = (module.title ?? "").toUpperCase();
      return code.includes(q) || title.includes(q);
    })
    .sort((a, b) => {
      if (a.hasModTreeMetadata !== b.hasModTreeMetadata) {
        return a.hasModTreeMetadata ? -1 : 1;
      }
      return a.moduleCode.localeCompare(b.moduleCode);
    })
    .slice(0, 8);
}

export function useModTreeModuleSearch() {
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const queryRef = useRef(query);

  useEffect(() => {
    let isMounted = true;

    getModTreeSearchCatalog()
      .then((data) => {
        if (isMounted) {
          setCatalog(data);
          setSuggestions(buildSuggestions(data, queryRef.current));
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load module catalog");
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateQuery = useMemo(() => {
    return (nextQuery) => {
      queryRef.current = nextQuery;
      setQuery(nextQuery);
      setSuggestions(buildSuggestions(catalog, nextQuery));
    };
  }, [catalog]);

  return {
    query,
    setQuery: updateQuery,
    suggestions,
    setSuggestions,
    loading,
    error,
  };
}
