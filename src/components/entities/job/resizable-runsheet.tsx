"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { Minus, MoveDiagonal2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const RUNSHEET_BASE_WIDTH = 800;
const MIN_WIDTH = 320;
const MAX_WIDTH = 2400;
const BUTTON_STEP = 0.25;
const KEYBOARD_STEP = 40;

type DragStart = { x: number; y: number; width: number };

function clampWidth({ width }: { width: number }) {
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)));
}

/**
 * Wraps a runsheet preview so it can be resized by pressing and dragging on
 * it (drag right or down to enlarge, left or up to shrink), by dragging the
 * corner grip, with the zoom buttons, or with the arrow keys on the grip.
 * While dragging the content is scaled with CSS; the final width is passed to
 * `children` as `renderWidth` on release so a PDF can re-render sharply.
 */
export function ResizableRunsheet({
  id,
  children,
}: {
  id: string;
  children: ({ renderWidth }: { renderWidth: number }) => ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [renderWidth, setRenderWidth] = useState(RUNSHEET_BASE_WIDTH);

  const currentWidth = () =>
    width ??
    (surfaceRef.current?.getBoundingClientRect().width ||
      RUNSHEET_BASE_WIDTH);

  const applyWidth = ({ nextWidth }: { nextWidth: number }) => {
    const clamped = clampWidth({ width: nextWidth });
    setWidth(clamped);
    setRenderWidth(clamped);
  };

  const resetWidth = () => {
    setWidth(null);
    setRenderWidth(RUNSHEET_BASE_WIDTH);
  };

  const startDrag = ({
    event,
    ignoreTouch,
  }: {
    event: PointerEvent<HTMLElement>;
    ignoreTouch: boolean;
  }) => {
    if (event.button !== 0) return;
    if (ignoreTouch && event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: currentWidth(),
    };
  };

  const handlePointerMove = ({
    clientX,
    clientY,
  }: {
    clientX: number;
    clientY: number;
  }) => {
    const start = dragStartRef.current;
    if (!start) return;
    const deltaX = clientX - start.x;
    const deltaY = clientY - start.y;
    const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
    setWidth(clampWidth({ width: start.width + delta }));
  };

  const endDrag = () => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    if (width !== null) setRenderWidth(width);
  };

  const handleGripKeyDown = ({
    event,
  }: {
    event: KeyboardEvent<HTMLDivElement>;
  }) => {
    const steps: Record<string, number> = {
      ArrowRight: KEYBOARD_STEP,
      ArrowDown: KEYBOARD_STEP,
      ArrowLeft: -KEYBOARD_STEP,
      ArrowUp: -KEYBOARD_STEP,
    };
    if (event.key === "Home" || event.key === "Escape") {
      event.preventDefault();
      resetWidth();
      return;
    }
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    applyWidth({ nextWidth: currentWidth() + step });
  };

  const zoomBy = ({ step }: { step: number }) => {
    const scale = currentWidth() / RUNSHEET_BASE_WIDTH;
    const nextScale = Math.round((scale + step) / BUTTON_STEP) * BUTTON_STEP;
    applyWidth({ nextWidth: nextScale * RUNSHEET_BASE_WIDTH });
  };

  const handleButtonKeyDown = ({
    event,
    action,
  }: {
    event: KeyboardEvent<HTMLButtonElement>;
    action: () => void;
  }) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  };

  const zoomOut = () => zoomBy({ step: -BUTTON_STEP });
  const zoomIn = () => zoomBy({ step: BUTTON_STEP });

  const zoomPercent =
    width === null ? null : Math.round((width / RUNSHEET_BASE_WIDTH) * 100);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end gap-1">
        <span className="mr-2 hidden text-xs text-muted-foreground sm:inline">
          Drag the runsheet to resize
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          id={`${id}-zoom-out-btn`}
          aria-label="Zoom out"
          disabled={width !== null && width <= MIN_WIDTH}
          onClick={zoomOut}
          onKeyDown={(event) => handleButtonKeyDown({ event, action: zoomOut })}
        >
          <Minus className="h-4 w-4" aria-hidden="true">
            <title>Zoom out</title>
          </Minus>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 min-w-16 px-2 text-xs tabular-nums"
          id={`${id}-zoom-reset-btn`}
          aria-label="Reset runsheet size"
          title="Reset to fit"
          onClick={resetWidth}
          onKeyDown={(event) =>
            handleButtonKeyDown({ event, action: resetWidth })
          }
        >
          {zoomPercent === null ? "Fit" : `${zoomPercent}%`}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          id={`${id}-zoom-in-btn`}
          aria-label="Zoom in"
          disabled={width !== null && width >= MAX_WIDTH}
          onClick={zoomIn}
          onKeyDown={(event) => handleButtonKeyDown({ event, action: zoomIn })}
        >
          <Plus className="h-4 w-4" aria-hidden="true">
            <title>Zoom in</title>
          </Plus>
        </Button>
      </div>
      <div
        ref={surfaceRef}
        id={`${id}-surface`}
        data-testid="resizable-runsheet-surface"
        className={`relative cursor-nwse-resize select-none ${
          width === null ? "w-[800px] max-w-full" : "max-w-none"
        }`}
        style={width === null ? undefined : { width }}
        onPointerDown={(event) => startDrag({ event, ignoreTouch: true })}
        onPointerMove={({ clientX, clientY }) =>
          handlePointerMove({ clientX, clientY })
        }
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(event) => event.preventDefault()}
      >
        {children({ renderWidth })}
        <div
          role="slider"
          tabIndex={0}
          id={`${id}-resize-grip`}
          aria-label="Resize runsheet"
          aria-orientation="horizontal"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={Math.round(width ?? renderWidth)}
          aria-valuetext={zoomPercent === null ? "Fit" : `${zoomPercent}%`}
          className="absolute right-0 bottom-0 flex h-7 w-7 touch-none items-center justify-center rounded-tl-md border-t border-l bg-background/90 text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          onPointerDown={(event) => startDrag({ event, ignoreTouch: false })}
          onKeyDown={(event) => handleGripKeyDown({ event })}
        >
          <MoveDiagonal2 className="h-4 w-4" aria-hidden="true">
            <title>Resize runsheet</title>
          </MoveDiagonal2>
        </div>
      </div>
    </div>
  );
}
