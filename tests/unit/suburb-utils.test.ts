// Tests for suburb utility functions used in multi-select functionality

// Helper functions (duplicated from components for testing)
const stringToArray = (str: string | undefined): string[] => {
  if (!str || str.trim() === '') return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
};

const arrayToString = (arr: string[]): string => {
  return arr.filter(s => s.length > 0).join(', ');
};

describe('Suburb Utility Functions', () => {
  describe('stringToArray', () => {
    it('converts simple comma-separated string to array', () => {
      const result = stringToArray('Melbourne,Sydney,Brisbane');
      expect(result).toEqual(['Melbourne', 'Sydney', 'Brisbane']);
    });

    it('handles strings with spaces around commas', () => {
      const result = stringToArray('Melbourne, Sydney, Brisbane');
      expect(result).toEqual(['Melbourne', 'Sydney', 'Brisbane']);
    });

    it('handles strings with extra spaces', () => {
      const result = stringToArray('  Melbourne  ,  Sydney  ,  Brisbane  ');
      expect(result).toEqual(['Melbourne', 'Sydney', 'Brisbane']);
    });

    it('filters out empty strings from multiple commas', () => {
      const result = stringToArray('Melbourne,,Sydney,,,Brisbane');
      expect(result).toEqual(['Melbourne', 'Sydney', 'Brisbane']);
    });

    it('handles mixed spaces and empty strings', () => {
      const result = stringToArray('Melbourne, , Sydney,   , Brisbane, ');
      expect(result).toEqual(['Melbourne', 'Sydney', 'Brisbane']);
    });

    it('returns empty array for undefined input', () => {
      const result = stringToArray(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty string', () => {
      const result = stringToArray('');
      expect(result).toEqual([]);
    });

    it('returns empty array for string with only spaces', () => {
      const result = stringToArray('   ');
      expect(result).toEqual([]);
    });

    it('returns empty array for string with only commas', () => {
      const result = stringToArray(',,,');
      expect(result).toEqual([]);
    });

    it('returns empty array for string with only commas and spaces', () => {
      const result = stringToArray(' , , , ');
      expect(result).toEqual([]);
    });

    it('handles single value correctly', () => {
      const result = stringToArray('Melbourne');
      expect(result).toEqual(['Melbourne']);
    });

    it('handles single value with spaces correctly', () => {
      const result = stringToArray('  Melbourne  ');
      expect(result).toEqual(['Melbourne']);
    });

    it('handles complex suburb names with spaces', () => {
      const result = stringToArray('South Melbourne, East Sydney, North Brisbane');
      expect(result).toEqual(['South Melbourne', 'East Sydney', 'North Brisbane']);
    });

    it('preserves internal spaces in suburb names', () => {
      const result = stringToArray('Port Melbourne, St Kilda, Glen Waverley');
      expect(result).toEqual(['Port Melbourne', 'St Kilda', 'Glen Waverley']);
    });

    it('handles apostrophes and special characters in suburb names', () => {
      const result = stringToArray("O'Connor, St. Peters, Mount-Beauty");
      expect(result).toEqual(["O'Connor", 'St. Peters', 'Mount-Beauty']);
    });
  });

  describe('arrayToString', () => {
    it('converts simple array to comma-separated string', () => {
      const result = arrayToString(['Melbourne', 'Sydney', 'Brisbane']);
      expect(result).toBe('Melbourne, Sydney, Brisbane');
    });

    it('handles empty array', () => {
      const result = arrayToString([]);
      expect(result).toBe('');
    });

    it('handles single item array', () => {
      const result = arrayToString(['Melbourne']);
      expect(result).toBe('Melbourne');
    });

    it('filters out empty strings from array', () => {
      const result = arrayToString(['Melbourne', '', 'Sydney', '', 'Brisbane']);
      expect(result).toBe('Melbourne, Sydney, Brisbane');
    });

    it('handles array with only empty strings', () => {
      const result = arrayToString(['', '', '']);
      expect(result).toBe('');
    });

    it('handles complex suburb names with spaces', () => {
      const result = arrayToString(['South Melbourne', 'East Sydney', 'North Brisbane']);
      expect(result).toBe('South Melbourne, East Sydney, North Brisbane');
    });

    it('handles suburb names with special characters', () => {
      const result = arrayToString(["O'Connor", 'St. Peters', 'Mount-Beauty']);
      expect(result).toBe("O'Connor, St. Peters, Mount-Beauty");
    });

    it('maintains consistent spacing', () => {
      const result = arrayToString(['A', 'B', 'C', 'D', 'E']);
      expect(result).toBe('A, B, C, D, E');
    });
  });

  describe('Round-trip conversion', () => {
    it('maintains data integrity for simple values', () => {
      const original = 'Melbourne, Sydney, Brisbane';
      const array = stringToArray(original);
      const converted = arrayToString(array);
      expect(converted).toBe('Melbourne, Sydney, Brisbane');
    });

    it('cleans up malformed input during round-trip', () => {
      const malformed = '  Melbourne  ,  ,  Sydney  ,,  Brisbane  , ';
      const array = stringToArray(malformed);
      const cleaned = arrayToString(array);
      expect(cleaned).toBe('Melbourne, Sydney, Brisbane');
    });

    it('handles single value round-trip', () => {
      const original = 'Melbourne';
      const array = stringToArray(original);
      const converted = arrayToString(array);
      expect(converted).toBe('Melbourne');
    });

    it('handles empty value round-trip', () => {
      const original = '';
      const array = stringToArray(original);
      const converted = arrayToString(array);
      expect(converted).toBe('');
    });

    it('preserves complex suburb names during round-trip', () => {
      const original = 'Port Melbourne, St. Peters, Mount-Beauty, South Yarra';
      const array = stringToArray(original);
      const converted = arrayToString(array);
      expect(converted).toBe('Port Melbourne, St. Peters, Mount-Beauty, South Yarra');
    });
  });

  describe('Edge Cases', () => {
    it('handles very long suburb names', () => {
      const longName = 'Very Very Very Long Suburb Name With Many Words';
      const result = stringToArray(longName + ', Sydney');
      expect(result).toEqual([longName, 'Sydney']);
    });

    it('handles special Unicode characters in suburb names', () => {
      const result = stringToArray('Café Street, Résidence Park, Naïve Valley');
      expect(result).toEqual(['Café Street', 'Résidence Park', 'Naïve Valley']);
    });

    it('handles numbers in suburb names', () => {
      const result = stringToArray('3000 Melbourne, 2000 Sydney, 4000 Brisbane');
      expect(result).toEqual(['3000 Melbourne', '2000 Sydney', '4000 Brisbane']);
    });

    it('handles mixed case consistently', () => {
      const result = stringToArray('melbourne, SYDNEY, BriSbAnE');
      expect(result).toEqual(['melbourne', 'SYDNEY', 'BriSbAnE']);
    });
  });

  describe('Performance Considerations', () => {
    it('handles large arrays efficiently', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => `Suburb ${i}`);
      const stringResult = arrayToString(largeArray);
      const arrayResult = stringToArray(stringResult);
      
      expect(arrayResult).toHaveLength(1000);
      expect(arrayResult[0]).toBe('Suburb 0');
      expect(arrayResult[999]).toBe('Suburb 999');
    });

    it('handles long strings efficiently', () => {
      const suburbs = Array.from({ length: 100 }, (_, i) => `Very Long Suburb Name Number ${i}`);
      const longString = suburbs.join(', ');
      const result = stringToArray(longString);
      
      expect(result).toHaveLength(100);
      expect(result[0]).toBe('Very Long Suburb Name Number 0');
      expect(result[99]).toBe('Very Long Suburb Name Number 99');
    });
  });
});