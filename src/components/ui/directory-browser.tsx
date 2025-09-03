"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Plus,
  FolderPlus,
} from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Collapsible, CollapsibleContent } from "./collapsible";
import { ScrollArea } from "./scroll-area";
import { Badge } from "./badge";
import { Spinner } from "./loading-skeleton";
import { Input } from "./input";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime?: string;
  parents?: string[];
  isFolder: boolean;
}

interface TreeNode extends DriveFile {
  children: TreeNode[];
  isExpanded: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  level: number;
}

interface DirectoryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  driveId: string;
  onSelectFolder?: (
    folderId: string,
    folderName: string,
    path: string[],
  ) => void;
  onSelectFile?: (fileId: string, fileName: string, path: string[]) => void;
  title?: string;
  allowFileSelection?: boolean;
  allowFolderSelection?: boolean;
}

export function DirectoryBrowser({
  isOpen,
  onClose,
  driveId,
  onSelectFolder,
  onSelectFile,
  title = "Browse Google Drive",
  allowFileSelection = true,
  allowFolderSelection = true,
}: DirectoryBrowserProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    name: string;
    isFolder: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Create folder state
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderParent, setCreateFolderParent] = useState<{
    id: string;
    path: TreeNode[];
  } | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Fetch files for a specific parent (or root)
  const fetchFiles = useCallback(
    async (parentId: string = "root"): Promise<DriveFile[]> => {
      try {
        const response = await fetch(
          `/api/google-drive/service-account?action=list-hierarchical-folders&driveId=${driveId}&parentId=${parentId}`,
        );
        const data = await response.json();

        if (response.ok && data.success) {
          return data.files;
        } else {
          throw new Error(data.error || "Failed to fetch files");
        }
      } catch (error) {
        console.error("Failed to fetch files:", error);
        throw error;
      }
    },
    [driveId],
  );

  // Load root level files
  const loadRootFiles = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const files = await fetchFiles("root");
      const nodes: TreeNode[] = files.map((file) => ({
        ...file,
        children: [],
        isExpanded: false,
        isLoaded: !file.isFolder, // Files are always "loaded", folders need to be expanded
        isLoading: false,
        level: 0,
      }));

      setRootNodes(nodes);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [fetchFiles]);

  // Load children for a specific node
  const loadNodeChildren = async (
    nodeId: string,
    path: TreeNode[],
  ): Promise<TreeNode[]> => {
    try {
      const files = await fetchFiles(nodeId);
      return files.map((file) => ({
        ...file,
        children: [],
        isExpanded: false,
        isLoaded: !file.isFolder,
        isLoading: false,
        level: path.length + 1, // Children should be one level deeper than their parent
      }));
    } catch (error) {
      console.error("Failed to load node children:", error);
      return [];
    }
  };

  // Toggle folder expansion
  const toggleNode = async (nodeId: string, path: TreeNode[] = []) => {
    // Helper function to find a node by path
    const findNodeByPath = (
      nodes: TreeNode[],
      targetPath: TreeNode[],
      targetId: string,
    ): TreeNode | null => {
      if (targetPath.length === 0) {
        return nodes.find((n) => n.id === targetId) || null;
      }

      const [nextNode, ...remainingPath] = targetPath;
      const node = nodes.find((n) => n.id === nextNode.id);
      if (node) {
        return findNodeByPath(node.children, remainingPath, targetId);
      }
      return null;
    };

    // Find the target node first
    const targetNode = findNodeByPath(rootNodes, path, nodeId);
    if (!targetNode) return;

    // If it's a folder that needs to load children
    if (targetNode.isFolder && !targetNode.isExpanded && !targetNode.isLoaded) {
      // Set loading state
      const setLoadingState = (
        nodes: TreeNode[],
        targetPath: TreeNode[],
      ): TreeNode[] => {
        if (targetPath.length === 0) {
          return nodes.map((node) =>
            node.id === nodeId ? { ...node, isLoading: true } : node,
          );
        }

        const [nextNode, ...remainingPath] = targetPath;
        return nodes.map((node) =>
          node.id === nextNode.id
            ? {
                ...node,
                children: setLoadingState(node.children, remainingPath),
              }
            : node,
        );
      };

      setRootNodes((nodes) => setLoadingState(nodes, path));

      try {
        const children = await loadNodeChildren(nodeId, path);

        // Update with loaded children
        const updateWithChildren = (
          nodes: TreeNode[],
          targetPath: TreeNode[],
        ): TreeNode[] => {
          if (targetPath.length === 0) {
            return nodes.map((node) =>
              node.id === nodeId
                ? {
                    ...node,
                    children,
                    isExpanded: true,
                    isLoaded: true,
                    isLoading: false,
                  }
                : node,
            );
          }

          const [nextNode, ...remainingPath] = targetPath;
          return nodes.map((node) =>
            node.id === nextNode.id
              ? {
                  ...node,
                  children: updateWithChildren(node.children, remainingPath),
                }
              : node,
          );
        };

        setRootNodes((nodes) => updateWithChildren(nodes, path));
      } catch (error) {
        console.error("Failed to load node children:", error);
        // Handle error by stopping loading state
        const stopLoadingState = (
          nodes: TreeNode[],
          targetPath: TreeNode[],
        ): TreeNode[] => {
          if (targetPath.length === 0) {
            return nodes.map((node) =>
              node.id === nodeId ? { ...node, isLoading: false } : node,
            );
          }

          const [nextNode, ...remainingPath] = targetPath;
          return nodes.map((node) =>
            node.id === nextNode.id
              ? {
                  ...node,
                  children: stopLoadingState(node.children, remainingPath),
                }
              : node,
          );
        };

        setRootNodes((nodes) => stopLoadingState(nodes, path));
      }
    } else {
      // Just toggle expansion for already loaded folders
      const toggleExpansion = (
        nodes: TreeNode[],
        targetPath: TreeNode[],
      ): TreeNode[] => {
        if (targetPath.length === 0) {
          return nodes.map((node) =>
            node.id === nodeId
              ? { ...node, isExpanded: !node.isExpanded }
              : node,
          );
        }

        const [nextNode, ...remainingPath] = targetPath;
        return nodes.map((node) =>
          node.id === nextNode.id
            ? {
                ...node,
                children: toggleExpansion(node.children, remainingPath),
              }
            : node,
        );
      };

      setRootNodes((nodes) => toggleExpansion(nodes, path));
    }
  };

  // Build path for a node
  const buildPath = (
    targetId: string,
    nodes: TreeNode[] = rootNodes,
    currentPath: string[] = [],
  ): string[] => {
    for (const node of nodes) {
      const newPath = [...currentPath, node.name];
      if (node.id === targetId) {
        return newPath;
      }
      if (node.children.length > 0) {
        const foundPath = buildPath(targetId, node.children, newPath);
        if (foundPath.length > 0) return foundPath;
      }
    }
    return [];
  };

  // Create folder function
  const createFolder = async () => {
    if (!newFolderName.trim() || !createFolderParent) return;

    setIsCreatingFolder(true);
    setError("");

    try {
      const parentId =
        createFolderParent.id === "root" ? "root" : createFolderParent.id;
      const response = await fetch(
        `/api/google-drive/service-account?action=create-folder&driveId=${driveId}&parentId=${parentId}&folderName=${encodeURIComponent(newFolderName.trim())}`,
      );
      const data = await response.json();

      if (response.ok && data.success) {
        // Add the new folder to the tree
        const newFolder: TreeNode = {
          ...data.folder,
          children: [],
          isExpanded: false,
          isLoaded: true, // It's a folder but empty, so considered loaded
          isLoading: false,
          level: createFolderParent.path.length,
        };

        // Update the tree to include the new folder
        const addFolderToTree = (
          nodes: TreeNode[],
          targetPath: TreeNode[],
        ): TreeNode[] => {
          if (targetPath.length === 0) {
            // Add to root level
            return [...nodes, newFolder].sort((a, b) => {
              // Sort folders first, then by name
              if (a.isFolder && !b.isFolder) return -1;
              if (!a.isFolder && b.isFolder) return 1;
              return a.name.localeCompare(b.name);
            });
          }

          const [nextNode, ...remainingPath] = targetPath;
          return nodes.map((node) =>
            node.id === nextNode.id
              ? {
                  ...node,
                  children: addFolderToTree(node.children, remainingPath),
                  isLoaded: true,
                  isExpanded: true, // Make sure parent is expanded to show new folder
                }
              : node,
          );
        };

        setRootNodes((nodes) =>
          addFolderToTree(nodes, createFolderParent.path),
        );

        // Reset create folder state
        setShowCreateFolder(false);
        setNewFolderName("");
        setCreateFolderParent(null);
      } else {
        setError(`Failed to create folder: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
      setError("Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Handle showing create folder dialog
  const handleShowCreateFolder = (parentId: string, parentPath: TreeNode[]) => {
    setCreateFolderParent({ id: parentId, path: parentPath });
    setShowCreateFolder(true);
    setNewFolderName("");
    setError("");
  };

  // Handle item selection
  const handleItemSelect = (item: TreeNode) => {
    const path = buildPath(item.id);
    setSelectedItem({ id: item.id, name: item.name, isFolder: item.isFolder });
    setSelectedPath(path);
  };

  // Handle confirm selection
  const handleConfirmSelection = () => {
    if (!selectedItem) return;

    const path = buildPath(selectedItem.id);

    if (selectedItem.isFolder && onSelectFolder && allowFolderSelection) {
      onSelectFolder(selectedItem.id, selectedItem.name, path);
      onClose();
    } else if (!selectedItem.isFolder && onSelectFile && allowFileSelection) {
      onSelectFile(selectedItem.id, selectedItem.name, path);
      onClose();
    }
  };

  // Render tree node
  const renderNode = (
    node: TreeNode,
    path: TreeNode[] = [],
  ): React.ReactNode => {
    const isSelected = selectedItem?.id === node.id;
    const hasChildren = node.isFolder;
    const canSelect =
      (node.isFolder && allowFolderSelection) ||
      (!node.isFolder && allowFileSelection);

    return (
      <div key={node.id} className="select-none">
        <div
          className={`group flex items-center gap-1 py-1 px-2 rounded hover:bg-accent cursor-pointer ${
            isSelected ? "bg-accent" : ""
          } ${!canSelect ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{ paddingLeft: `${node.level * 24 + 8}px` }}
          onClick={() => canSelect && handleItemSelect(node)}
        >
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id, path);
              }}
              disabled={node.isLoading}
            >
              {node.isLoading ? (
                <Spinner size="sm" />
              ) : node.isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}

          {!hasChildren && <div className="w-4" />}

          {node.isFolder ? (
            <Folder className="h-4 w-4 text-blue-500 mr-2" />
          ) : node.mimeType.startsWith("image/") ? (
            <ImageIcon className="h-4 w-4 text-green-500 mr-2" />
          ) : (
            <FileText className="h-4 w-4 text-gray-500 mr-2" />
          )}

          <span className="flex-1 text-sm truncate">{node.name}</span>

          {node.isFolder && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                handleShowCreateFolder(node.id, [...path, node]);
              }}
              title="Create folder"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}

          {!node.isFolder && (
            <Badge variant="outline" className="text-xs ml-2">
              {node.mimeType.split("/").pop()?.toUpperCase()}
            </Badge>
          )}
        </div>

        {hasChildren && node.isExpanded && (
          <Collapsible open={node.isExpanded}>
            <CollapsibleContent>
              {node.children.map((child) => renderNode(child, [...path, node]))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  };

  // Load root files when dialog opens
  useEffect(() => {
    if (isOpen && driveId) {
      loadRootFiles();
    }
  }, [isOpen, driveId, loadRootFiles]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 flex flex-col min-h-0">
            {/* Path breadcrumb */}
            {selectedPath.length > 0 && (
              <div className="px-4 py-2 bg-muted rounded mb-4">
                <div className="text-sm text-muted-foreground">Selected:</div>
                <div className="text-sm font-mono">
                  {selectedPath.join(" / ")}
                </div>
              </div>
            )}

            {/* File tree */}
            <ScrollArea className="flex-1 border rounded h-[400px]">
              <div className="p-2 space-y-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner className="mr-2" />
                    <span>Loading files...</span>
                  </div>
                ) : error ? (
                  <div className="text-center py-8">
                    <div className="text-red-500 mb-2">{error}</div>
                    <Button onClick={loadRootFiles} size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : rootNodes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No files found
                  </div>
                ) : (
                  rootNodes.map((node) => renderNode(node))
                )}
              </div>
            </ScrollArea>

            {/* Action buttons */}
            <div className="flex justify-between items-center pt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleShowCreateFolder("root", [])}
                  disabled={isLoading}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
                <div className="text-sm text-muted-foreground">
                  {allowFolderSelection && allowFileSelection
                    ? "Select a folder or file"
                    : allowFolderSelection
                      ? "Select a folder"
                      : "Select a file"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmSelection}
                  disabled={!selectedItem}
                >
                  Select
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Folder Name:</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    createFolder();
                  }
                }}
                disabled={isCreatingFolder}
              />
            </div>

            {createFolderParent && (
              <div className="text-sm text-muted-foreground">
                <span>Location: </span>
                <span className="font-mono">
                  {createFolderParent.id === "root"
                    ? "/"
                    : createFolderParent.path.map((p) => p.name).join(" / ")}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCreateFolder(false)}
                disabled={isCreatingFolder}
              >
                Cancel
              </Button>
              <Button
                onClick={createFolder}
                disabled={!newFolderName.trim() || isCreatingFolder}
              >
                {isCreatingFolder ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
