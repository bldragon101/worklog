/**
 * Unit tests for column visibility logic
 * Tests the core functionality without complex UI dependencies
 */

import type { VisibilityState } from '@tanstack/react-table';

// Mock the column visibility logic functions
interface ColumnVisibilityManager {
  getColumnVisibility(): VisibilityState;
  setColumnVisibility(newState: VisibilityState): void;
  toggleColumn(columnId: string): void;
  isColumnVisible(columnId: string): boolean;
  getVisibleColumns(): string[];
  getHiddenColumns(): string[];
}

class ColumnVisibilityManagerImpl implements ColumnVisibilityManager {
  private state: VisibilityState = {};

  constructor(initialState: VisibilityState = {}) {
    this.state = { ...initialState };
  }

  getColumnVisibility(): VisibilityState {
    return { ...this.state };
  }

  setColumnVisibility(newState: VisibilityState): void {
    this.state = { ...newState };
  }

  toggleColumn(columnId: string): void {
    const currentValue = this.state[columnId];
    // If undefined, column is visible by default, so toggle should make it hidden (false)
    // If false, toggle should make it visible (true)
    // If true, toggle should make it hidden (false)
    this.state = {
      ...this.state,
      [columnId]: currentValue === false ? true : false,
    };
  }

  isColumnVisible(columnId: string): boolean {
    // Columns are visible by default if not explicitly set to false
    return this.state[columnId] !== false;
  }

  getVisibleColumns(): string[] {
    return Object.entries(this.state)
      .filter(([, visible]) => visible !== false)
      .map(([columnId]) => columnId);
  }

  getHiddenColumns(): string[] {
    return Object.entries(this.state)
      .filter(([, visible]) => visible === false)
      .map(([columnId]) => columnId);
  }
}

describe('Column Visibility Logic', () => {
  let manager: ColumnVisibilityManager;

  beforeEach(() => {
    manager = new ColumnVisibilityManagerImpl();
  });

  describe('Initial State', () => {
    it('should have empty state by default', () => {
      expect(manager.getColumnVisibility()).toEqual({});
    });

    it('should accept initial state', () => {
      const initialState = { col1: true, col2: false };
      manager = new ColumnVisibilityManagerImpl(initialState);
      expect(manager.getColumnVisibility()).toEqual(initialState);
    });

    it('should treat undefined columns as visible', () => {
      expect(manager.isColumnVisible('undefinedColumn')).toBe(true);
    });
  });

  describe('Column Visibility State Management', () => {
    it('should update state correctly', () => {
      const newState = { col1: true, col2: false, col3: true };
      manager.setColumnVisibility(newState);
      expect(manager.getColumnVisibility()).toEqual(newState);
    });

    it('should maintain immutability', () => {
      const originalState = { col1: true };
      manager.setColumnVisibility(originalState);
      
      const retrievedState = manager.getColumnVisibility();
      retrievedState.col2 = false;
      
      // Original state should not be modified
      expect(manager.getColumnVisibility()).toEqual({ col1: true });
    });

    it('should handle empty state', () => {
      manager.setColumnVisibility({});
      expect(manager.getColumnVisibility()).toEqual({});
    });
  });

  describe('Column Toggling', () => {
    it('should toggle column from undefined to false', () => {
      manager.toggleColumn('col1');
      expect(manager.isColumnVisible('col1')).toBe(false);
      expect(manager.getColumnVisibility()).toEqual({ col1: false });
    });

    it('should toggle column from false to true', () => {
      manager.setColumnVisibility({ col1: false });
      manager.toggleColumn('col1');
      expect(manager.isColumnVisible('col1')).toBe(true);
      expect(manager.getColumnVisibility()).toEqual({ col1: true });
    });

    it('should toggle column from true to false', () => {
      manager.setColumnVisibility({ col1: true });
      manager.toggleColumn('col1');
      expect(manager.isColumnVisible('col1')).toBe(false);
      expect(manager.getColumnVisibility()).toEqual({ col1: false });
    });

    it('should handle multiple toggles correctly', () => {
      // Start undefined (visible)
      expect(manager.isColumnVisible('col1')).toBe(true);
      
      // Toggle to hidden
      manager.toggleColumn('col1');
      expect(manager.isColumnVisible('col1')).toBe(false);
      
      // Toggle back to visible
      manager.toggleColumn('col1');
      expect(manager.isColumnVisible('col1')).toBe(true);
      
      // Toggle to hidden again
      manager.toggleColumn('col1');
      expect(manager.isColumnVisible('col1')).toBe(false);
    });

    it('should handle toggling multiple columns', () => {
      manager.setColumnVisibility({ col1: true, col2: false, col3: true });
      
      manager.toggleColumn('col1'); // true -> false
      manager.toggleColumn('col2'); // false -> true
      manager.toggleColumn('col4'); // undefined -> false
      
      expect(manager.getColumnVisibility()).toEqual({
        col1: false,
        col2: true,
        col3: true,
        col4: false,
      });
    });
  });

  describe('Column Visibility Queries', () => {
    beforeEach(() => {
      manager.setColumnVisibility({
        visible1: true,
        visible2: true,
        hidden1: false,
        hidden2: false,
      });
    });

    it('should correctly identify visible columns', () => {
      expect(manager.isColumnVisible('visible1')).toBe(true);
      expect(manager.isColumnVisible('visible2')).toBe(true);
      expect(manager.isColumnVisible('undefinedColumn')).toBe(true);
    });

    it('should correctly identify hidden columns', () => {
      expect(manager.isColumnVisible('hidden1')).toBe(false);
      expect(manager.isColumnVisible('hidden2')).toBe(false);
    });

    it('should return visible column IDs', () => {
      const visibleColumns = manager.getVisibleColumns();
      expect(visibleColumns).toContain('visible1');
      expect(visibleColumns).toContain('visible2');
      expect(visibleColumns).not.toContain('hidden1');
      expect(visibleColumns).not.toContain('hidden2');
    });

    it('should return hidden column IDs', () => {
      const hiddenColumns = manager.getHiddenColumns();
      expect(hiddenColumns).toContain('hidden1');
      expect(hiddenColumns).toContain('hidden2');
      expect(hiddenColumns).not.toContain('visible1');
      expect(hiddenColumns).not.toContain('visible2');
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      // Set initial state
      manager.setColumnVisibility({ col1: true, col2: false });
      
      // Perform operations
      manager.toggleColumn('col3'); // undefined -> false
      manager.toggleColumn('col1'); // true -> false
      
      // Check final state
      expect(manager.getColumnVisibility()).toEqual({
        col1: false,
        col2: false,
        col3: false,
      });
      
      // State should persist
      expect(manager.isColumnVisible('col1')).toBe(false);
      expect(manager.isColumnVisible('col2')).toBe(false);
      expect(manager.isColumnVisible('col3')).toBe(false);
    });

    it('should handle complex state transitions', () => {
      // Start with mixed state
      manager.setColumnVisibility({ a: true, b: false, c: true });
      
      // Series of operations
      manager.toggleColumn('a'); // true -> false
      manager.setColumnVisibility({ a: false, b: true, c: false, d: true });
      manager.toggleColumn('b'); // true -> false
      manager.toggleColumn('e'); // undefined -> false
      
      // Verify final state
      expect(manager.getColumnVisibility()).toEqual({
        a: false,
        b: false,
        c: false,
        d: true,
        e: false,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle special column names', () => {
      const specialColumns = {
        'col-with-dashes': true,
        'col_with_underscores': false,
        'col.with.dots': true,
        'col with spaces': false,
        '123numeric': true,
      };
      
      manager.setColumnVisibility(specialColumns);
      
      Object.entries(specialColumns).forEach(([columnId, visible]) => {
        expect(manager.isColumnVisible(columnId)).toBe(visible);
      });
    });

    it('should handle empty string column ID', () => {
      manager.setColumnVisibility({ '': false });
      expect(manager.isColumnVisible('')).toBe(false);
      
      manager.toggleColumn('');
      expect(manager.isColumnVisible('')).toBe(true);
    });

    it('should handle large number of columns', () => {
      const largeState: VisibilityState = {};
      for (let i = 0; i < 1000; i++) {
        largeState[`col${i}`] = i % 2 === 0;
      }
      
      manager.setColumnVisibility(largeState);
      
      // Verify some columns
      expect(manager.isColumnVisible('col0')).toBe(true);
      expect(manager.isColumnVisible('col1')).toBe(false);
      expect(manager.isColumnVisible('col500')).toBe(true);
      expect(manager.isColumnVisible('col501')).toBe(false);
      
      // Toggle some columns
      manager.toggleColumn('col0');
      manager.toggleColumn('col1');
      
      expect(manager.isColumnVisible('col0')).toBe(false);
      expect(manager.isColumnVisible('col1')).toBe(true);
    });

    it('should handle rapid successive toggles', () => {
      const columnId = 'rapidToggleColumn';
      
      // Start undefined (visible by default)
      expect(manager.isColumnVisible(columnId)).toBe(true);
      
      // Perform many rapid toggles (100 times)
      for (let i = 0; i < 100; i++) {
        manager.toggleColumn(columnId);
      }
      
      // 100 toggles from initial undefined (visible) state:
      // 1st toggle: undefined (visible) -> false
      // 2nd toggle: false -> true  
      // 3rd toggle: true -> false
      // 4th toggle: false -> true
      // ...
      // 100th toggle: false -> true
      // So even number of toggles should end up true (visible)
      expect(manager.isColumnVisible(columnId)).toBe(true);
      
      // Verify the state is actually set correctly
      expect(manager.getColumnVisibility()[columnId]).toBe(true);
    });
  });
});