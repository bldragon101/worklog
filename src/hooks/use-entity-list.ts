"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";

type EntityResource = "customers" | "drivers" | "vehicles";

const EMPTY_LIST: never[] = [];

function capitalise({ text }: { text: string }) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Shared list, form and delete-dialog state for the simple entity pages
 * (customers, drivers, vehicles).
 *
 * Loads `/api/{resource}` with React Query and exposes helpers for the
 * add/edit form, single-row deletes and the multi-delete confirmation dialog.
 */
export function useEntityList<T extends { id: number }>({
  resource,
  singularLabel,
}: {
  resource: EntityResource;
  singularLabel: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const keys = queryKeys[resource];
  const url = `/api/${resource}`;

  const listQuery = useQuery({
    queryKey: keys.list,
    queryFn: async () => {
      try {
        return await fetchJson<T[]>({
          url,
          fallbackMessage: `Failed to fetch ${resource}`,
        });
      } catch (error) {
        console.error(`Error fetching ${resource}:`, error);
        toast({
          title: `Failed to load ${resource}`,
          description:
            error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
  });
  const items: T[] = listQuery.data ?? EMPTY_LIST;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [loadingRowId, setLoadingRowId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<T[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Refetch the list (and any other queries for this resource). */
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.all });

  /** Replace the cached list without refetching. */
  const setItems = ({ update }: { update: (previous: T[]) => T[] }) => {
    queryClient.setQueryData<T[]>(keys.list, (previous) =>
      update(previous ?? []),
    );
  };

  const openAddForm = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: T) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  /**
   * Delete one row (the row menu has already asked to confirm), then refresh.
   * Throws with the server's error so the row's dialog can report it.
   */
  const deleteItem = async ({ item }: { item: T }) => {
    setLoadingRowId(item.id);
    try {
      const response = await fetch(`${url}/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Failed to delete ${singularLabel}:`, errorData.error);
        throw new Error(errorData.error || `Failed to delete ${singularLabel}`);
      }

      await refresh();
    } catch (error) {
      console.error(`Error deleting ${singularLabel}:`, error);
      throw error;
    } finally {
      setLoadingRowId(null);
    }
  };

  /** Open the multi-delete confirmation dialog for the selected rows. */
  const requestMultiDelete = async (selected: T[]) => {
    setItemsToDelete(selected);
    setDeleteDialogOpen(true);
  };

  /** Delete the given rows in parallel, report the outcome and refresh. */
  const deleteItems = async ({ items: targets }: { items: T[] }) => {
    setIsDeleting(true);
    try {
      const results = await Promise.all(
        targets.map((item) =>
          fetch(`${url}/${item.id}`, { method: "DELETE" }),
        ),
      );
      const allOk = results.every((res) => res.ok);

      if (allOk) {
        toast({
          title: `${capitalise({ text: resource })} deleted successfully`,
          description: `${targets.length} ${singularLabel}${targets.length === 1 ? "" : "s"} deleted`,
          variant: "default",
        });
      } else {
        toast({
          title: "Some deletions failed",
          description: "Please refresh and try again",
          variant: "destructive",
        });
      }
      setDeleteDialogOpen(false);
      setItemsToDelete([]);
      await refresh();
    } catch (error) {
      console.error(`Error deleting ${resource}:`, error);
      toast({
        title: `Error deleting ${resource}`,
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  /** Confirm handler for the multi-delete dialog. */
  const confirmMultiDelete = () => deleteItems({ items: itemsToDelete });

  return {
    items,
    isLoading: listQuery.isLoading,
    refresh,
    setItems,
    isFormOpen,
    editingItem,
    openAddForm,
    openEditForm,
    closeForm,
    loadingRowId,
    deleteItem,
    deleteDialogOpen,
    setDeleteDialogOpen,
    itemsToDelete,
    isDeleting,
    requestMultiDelete,
    deleteItems,
    confirmMultiDelete,
  };
}
