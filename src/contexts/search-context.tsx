"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SearchContextType {
  globalSearchValue: string;
  setGlobalSearchValue: (value: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [globalSearchValue, setGlobalSearchValue] = useState<string>('');

  return (
    <SearchContext.Provider value={{ globalSearchValue, setGlobalSearchValue }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}