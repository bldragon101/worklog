"use client";

import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Cloud,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Import required CSS for react-pdf
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import Image from "next/image";

// Configure PDF.js worker using local file with correct version (5.3.31 to match react-pdf)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  isFolder: boolean;
}

interface FileViewerProps {
  file: DriveFile;
  onViewInDrive: (fileId: string) => void;
  getFileUrl: (fileId: string) => Promise<string>;
}

export function FileViewer({
  file,
  onViewInDrive,
  getFileUrl,
}: FileViewerProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [fileUrl, setFileUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // PDF-specific state
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [pageWidth, setPageWidth] = useState<number>(800);

  const isImage = file.mimeType.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";

  const handleViewFile = useCallback(async () => {
    if (!isImage && !isPDF) return;

    setIsLoading(true);
    setError("");

    try {
      const url = await getFileUrl(file.id);
      setFileUrl(url);
      setIsViewerOpen(true);

      // Set responsive width for PDF based on full-screen 16:9 container
      if (isPDF && typeof window !== "undefined") {
        // Calculate width based on full-screen 16:9 aspect ratio container
        const containerHeight = window.innerHeight - 120; // Account for toolbar
        const containerWidth = window.innerWidth;
        const aspectRatioWidth = containerHeight * (16 / 9);
        const availableWidth = Math.min(containerWidth, aspectRatioWidth) * 0.9; // 90% of container
        setPageWidth(availableWidth);
      }
    } catch (err) {
      setError("Failed to load file");
      console.error("Error loading file:", err);
    } finally {
      setIsLoading(false);
    }
  }, [file.id, getFileUrl, isImage, isPDF]);

  const handleCloseViewer = useCallback(() => {
    setIsViewerOpen(false);
    setFileUrl("");
    setPageNumber(1);
    setScale(1.0);
    setRotation(0);
    setError("");
  }, []);

  // PDF handlers
  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    [],
  );

  const onDocumentLoadError = useCallback((error: Error) => {
    setError("Failed to load PDF: " + error.message);
    console.error("PDF load error:", error);
  }, []);

  const changePage = useCallback(
    (offset: number) => {
      setPageNumber((prevPageNumber) =>
        Math.min(Math.max(prevPageNumber + offset, 1), numPages),
      );
    },
    [numPages],
  );

  const previousPage = useCallback(() => changePage(-1), [changePage]);
  const nextPage = useCallback(() => changePage(1), [changePage]);

  const zoomIn = useCallback(
    () => setScale((prev) => Math.min(prev + 0.25, 3.0)),
    [],
  );
  const zoomOut = useCallback(
    () => setScale((prev) => Math.max(prev - 0.25, 0.5)),
    [],
  );
  const rotate = useCallback(
    () => setRotation((prev) => (prev + 90) % 360),
    [],
  );

  if (file.isFolder || (!isImage && !isPDF)) {
    return (
      <div className="flex gap-1">
        <Button
          onClick={() => onViewInDrive(file.id)}
          variant="outline"
          size="sm"
          id={`view-in-drive-${file.id}`}
        >
          <Cloud className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-1">
        <Button
          onClick={handleViewFile}
          variant="outline"
          size="sm"
          disabled={isLoading}
          id={`view-file-${file.id}`}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          onClick={() => onViewInDrive(file.id)}
          variant="outline"
          size="sm"
          id={`view-in-drive-${file.id}`}
        >
          <Cloud className="h-4 w-4" />
        </Button>
      </div>

      {/* Image Viewer */}
      {isImage && isViewerOpen && fileUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col z-50"
          id="image-viewer-modal"
        >
          {/* Static Image Toolbar */}
          <div className="fixed top-4 left-4 right-4 z-60 flex items-center justify-between p-4 bg-black/70 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-4">
              <h3 className="text-white font-semibold truncate max-w-md">
                {file.name}
              </h3>
              <Badge variant="secondary">{Math.round(scale * 100)}%</Badge>
              <Badge variant="secondary">{rotation}°</Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="text-white hover:bg-white/20"
                id="image-zoom-out-btn"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={zoomIn}
                disabled={scale >= 3.0}
                className="text-white hover:bg-white/20"
                id="image-zoom-in-btn"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              {/* Rotation */}
              <Button
                variant="ghost"
                size="sm"
                onClick={rotate}
                className="text-white hover:bg-white/20"
                id="image-rotate-btn"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              {/* External Actions */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewInDrive(file.id)}
                className="text-white hover:bg-white/20"
                id="image-view-in-drive-btn"
              >
                <Cloud className="h-4 w-4" />
              </Button>

              {/* Close */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseViewer}
                className="text-white hover:bg-white/20"
                id="image-close-btn"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Full-Screen 16:9 Image Content Container */}
          <div className="flex-1 flex justify-center items-center p-4">
            <div
              className="relative bg-black/20 flex justify-center items-center overflow-hidden"
              style={{
                width: "min(100vw, calc(100vh * 16/9))",
                height: "min(100vh, calc(100vw * 9/16))",
                aspectRatio: "16/9",
              }}
            >
              <Image
                src={fileUrl}
                alt={file.name}
                className="transition-transform duration-200 ease-in-out"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  cursor: scale > 1 ? "grab" : "default",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
                width={pageWidth}
                height={pageWidth * (9 / 16)}
                draggable={false}
                id="image-display"
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {isPDF && isViewerOpen && fileUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col z-50"
          id="pdf-viewer-modal"
        >
          {/* Static PDF Toolbar */}
          <div className="fixed top-4 left-4 right-4 z-60 flex items-center justify-between p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold truncate max-w-md">{file.name}</h3>
              <Badge variant="outline">
                Page {pageNumber} of {numPages}
              </Badge>
              <Badge variant="outline">{Math.round(scale * 100)}%</Badge>
              <Badge variant="outline">{rotation}°</Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* Navigation */}
              <Button
                variant="outline"
                size="sm"
                onClick={previousPage}
                disabled={pageNumber <= 1}
                id="pdf-previous-page-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={nextPage}
                disabled={pageNumber >= numPages}
                id="pdf-next-page-btn"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Zoom Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                disabled={scale <= 0.5}
                id="pdf-zoom-out-btn"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                disabled={scale >= 3.0}
                id="pdf-zoom-in-btn"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

              {/* Rotation */}
              <Button
                variant="outline"
                size="sm"
                onClick={rotate}
                id="pdf-rotate-btn"
              >
                <RotateCw className="h-4 w-4" />
              </Button>

              {/* External Actions */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewInDrive(file.id)}
                id="pdf-view-in-drive-btn"
              >
                <Cloud className="h-4 w-4" />
              </Button>

              {/* Close */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseViewer}
                id="pdf-close-btn"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Full-Screen 16:9 PDF Content Container */}
          <div className="flex-1 flex justify-center items-center p-4 pt-24">
            <div
              className="relative bg-white/10 backdrop-blur-sm rounded-lg flex justify-center items-center overflow-hidden"
              style={{
                width: "min(100vw, calc(100vh * 16/9))",
                height: "min(calc(100vh - 120px), calc(100vw * 9/16))",
                aspectRatio: "16/9",
              }}
            >
              {error ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">{error}</p>
                  <Button onClick={handleCloseViewer} variant="outline">
                    Close
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center items-center h-full w-full overflow-auto">
                  <Document
                    file={fileUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center py-8">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500" />
                        <span className="ml-2 text-white">Loading PDF...</span>
                      </div>
                    }
                  >
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      rotate={rotation}
                      width={pageWidth}
                      className="shadow-2xl"
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={
                        <div className="flex items-center justify-center py-4">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-500" />
                        </div>
                      }
                    />
                  </Document>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && !isViewerOpen && (
        <div className="text-red-600 text-sm mt-2">{error}</div>
      )}
    </>
  );
}
