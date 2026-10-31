"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const PAGE_WIDTH = 800;

export function JobRunsheetPdf({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState("");

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
      onLoadError={(loadError) => {
        console.error("Runsheet PDF load error:", loadError);
        setError("Failed to render the runsheet PDF");
      }}
      loading={<RunsheetPdfLoading />}
    >
      <div className="flex flex-col gap-3">
        {Array.from({ length: numPages }, (_, index) => (
          <Page
            key={index + 1}
            pageNumber={index + 1}
            width={PAGE_WIDTH}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="overflow-hidden rounded border bg-white shadow-sm [&_canvas]:!h-auto [&_canvas]:!max-w-full"
            loading={<RunsheetPdfLoading />}
          />
        ))}
      </div>
    </Document>
  );
}

function RunsheetPdfLoading() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-muted-foreground" />
      Rendering runsheet...
    </div>
  );
}
