"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface SearchContextType {
  globalSearchValue: string;
  setGlobalSearchValue: (value: string) => void;
  debouncedSearchValue: string;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [globalSearchValue, setGlobalSearchValue] = useState<string>("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>("");

  // Debounce search value with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(globalSearchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [globalSearchValue]);

  return (
    <SearchContext.Provider
      value={{ globalSearchValue, setGlobalSearchValue, debouncedSearchValue }}
    >
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return context;
}
