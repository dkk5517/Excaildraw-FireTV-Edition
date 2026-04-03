/**
 * FireTVController.tsx
 *
 * Provides a D-pad / Fire TV remote–friendly interaction layer on top of
 * Excalidraw.  The component:
 *
 *  1. Renders a **virtual cursor** that the user steers with the D-pad.
 *  2. Intercepts key events that map to Fire TV remote buttons and
 *     translates them into Excalidraw API calls (tool selection, element
 *     creation, canvas pan/zoom, undo/redo, etc.).
 *  3. Displays a **persistent HUD toolbar** along the bottom of the screen
 *     showing the currently active tool and quick-reference controls.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  Fire TV Remote → Web KeyEvent Mapping (from Amazon Developer docs)
 * ─────────────────────────────────────────────────────────────────────────
 *  D-pad Up/Down/Left/Right  →  ArrowUp / ArrowDown / ArrowLeft / ArrowRight
 *  Select (D-pad Center)     →  Enter
 *  Back                      →  Backspace  (or Escape in Silk browser)
 *  Menu                      →  ContextMenu
 *  Play/Pause                →  MediaPlayPause
 *  Rewind                    →  MediaRewind   (not always present)
 *  Fast Forward              →  MediaFastForward (not always present)
 * ─────────────────────────────────────────────────────────────────────────
 *
 *  Control scheme (designed for a five-button remote + media keys):
 *
 *  D-pad           → Move virtual cursor / pan canvas (when in pan mode)
 *  Select (Enter)  → "Click" at cursor position (start/finish drawing)
 *  Back            → Cancel current action / deselect / undo
 *  Menu            → Open tool picker ring
 *  Rewind          → Previous tool
 *  Fast Forward    → Next tool
 *  Play/Pause      → Toggle draw ↔ select mode
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

// ── Constants ────────────────────────────────────────────────────────────

/** Pixels the virtual cursor moves per D-pad tick */
const CURSOR_STEP = 20;
/** Accelerated step when holding a direction */
const CURSOR_STEP_FAST = 60;
/** Milliseconds until a held key triggers "fast" mode */
const FAST_THRESHOLD_MS = 400;
/** Virtual cursor size (diameter in px) */
const CURSOR_SIZE = 28;
/** How long (ms) you must hold Back to open the help overlay */
const HELP_HOLD_MS = 600;
/** Arrow keys used for D-pad */
const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;

/** Tool cycle order – matches Excalidraw SHAPES minus hand & laser */
const TOOL_CYCLE = [
  "selection",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "eraser",
] as const;

type ToolType = (typeof TOOL_CYCLE)[number];

/** Friendly labels for the HUD */
const TOOL_LABELS: Record<string, string> = {
  selection: "Select",
  rectangle: "Rectangle",
  diamond: "Diamond",
  ellipse: "Ellipse",
  arrow: "Arrow",
  line: "Line",
  freedraw: "Draw",
  text: "Text",
  eraser: "Eraser",
};

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.getAttribute("role") === "textbox"
  );
}

// ── Component ────────────────────────────────────────────────────────────

interface FireTVControllerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  children: React.ReactNode;
}

export default function FireTVController({
  excalidrawAPI,
  children,
}: FireTVControllerProps) {
  // Virtual cursor position (viewport-relative px)
  const [cx, setCx] = useState(
    () => (typeof window !== "undefined" ? window.innerWidth : 960) / 2,
  );
  const [cy, setCy] = useState(
    () => (typeof window !== "undefined" ? window.innerHeight : 540) / 2,
  );

  // Current tool index
  const [toolIdx, setToolIdx] = useState(0);
  // Is the user currently "drawing" (pointer-down)?
  const [drawing, setDrawing] = useState(false);
  // Show the tool ring overlay?
  const [showToolRing, setShowToolRing] = useState(false);
  // Show the help overlay?
  const [showHelp, setShowHelp] = useState(false);

  // Freedraw: auto-stroke is active when D-pad is held in freedraw mode
  const freedrawStrokeRef = useRef(false);
  // Timer for long-press Back → help
  const backHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track held-key timing for acceleration
  const heldKeys = useRef<Record<string, number>>({});
  // Refs for latest cursor position (avoids stale closures)
  const cxRef = useRef(cx);
  const cyRef = useRef(cy);
  cxRef.current = cx;
  cyRef.current = cy;

  const toolIdxRef = useRef(toolIdx);
  toolIdxRef.current = toolIdx;

  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────

  const activeTool = TOOL_CYCLE[toolIdx];
  // Stable ref so arrow-key handlers read latest tool without stale closures
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  // ── Synthetic pointer events ─────────────────────────────────────────

  const dispatchPointerEvent = useCallback(
    (type: "pointerdown" | "pointermove" | "pointerup") => {
      const canvas = containerRef.current?.querySelector(
        ".excalidraw canvas.interactive",
      ) as HTMLCanvasElement | null;
      if (!canvas) {
        return;
      }
      if (typeof PointerEvent === "undefined") {
        return;
      }
      const clientX = cxRef.current;
      const clientY = cyRef.current;
      const evt = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: type === "pointerup" ? 0 : 1,
        pressure: type === "pointerup" ? 0 : 0.5,
      });
      canvas.dispatchEvent(evt);
    },
    [],
  );

  // ── Tool switching helpers ───────────────────────────────────────────

  const cycleTool = useCallback(
    (dir: 1 | -1) => {
      setToolIdx((prev) => {
        const next =
          (prev + dir + TOOL_CYCLE.length) % TOOL_CYCLE.length;
        const tool = TOOL_CYCLE[next];
        excalidrawAPI?.setActiveTool({ type: tool as any });
        return next;
      });
    },
    [excalidrawAPI],
  );

  const pickTool = useCallback(
    (idx: number) => {
      setToolIdx(idx);
      const tool = TOOL_CYCLE[idx];
      excalidrawAPI?.setActiveTool({ type: tool as any });
      setShowToolRing(false);
    },
    [excalidrawAPI],
  );

  // ── Undo / Select-All via synthetic keyboard events ────────────────────

  const undo = useCallback(() => {
    const evt = new KeyboardEvent("keydown", {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(evt);
  }, []);

  const selectAll = useCallback(() => {
    const evt = new KeyboardEvent("keydown", {
      key: "a",
      code: "KeyA",
      ctrlKey: true,
      bubbles: true,
    });
    document.dispatchEvent(evt);
  }, []);

  // End a freedraw stroke if one is active
  const endFreedrawStroke = useCallback(() => {
    if (freedrawStrokeRef.current) {
      dispatchPointerEvent("pointerup");
      freedrawStrokeRef.current = false;
      setDrawing(false);
    }
  }, [dispatchPointerEvent]);

  // ── Key event handler ────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!showToolRing && !showHelp && isEditableTarget(e.target)) {
        return;
      }

      // Any key dismisses help overlay
      if (showHelp) {
        e.preventDefault();
        setShowHelp(false);
        return;
      }

      // If the tool ring is open, D-pad selects within the ring
      if (showToolRing) {
        switch (e.key) {
          case "ArrowLeft":
            e.preventDefault();
            setToolIdx((p) => (p - 1 + TOOL_CYCLE.length) % TOOL_CYCLE.length);
            return;
          case "ArrowRight":
            e.preventDefault();
            setToolIdx((p) => (p + 1) % TOOL_CYCLE.length);
            return;
          case "ArrowUp":
          case "ArrowDown":
            e.preventDefault();
            return;
          case "Enter":
            e.preventDefault();
            pickTool(toolIdxRef.current);
            return;
          case "Backspace":
          case "Escape":
            e.preventDefault();
            setShowToolRing(false);
            return;
        }
      }

      const now = Date.now();
      const held = heldKeys.current[e.key];
      const fast = held && now - held > FAST_THRESHOLD_MS;
      if (!held) {
        heldKeys.current[e.key] = now;
      }

      const step = fast ? CURSOR_STEP_FAST : CURSOR_STEP;

      switch (e.key) {
        // ─── D-pad → move virtual cursor ─────────────────────────
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setCy((p) => {
            const v = clamp(p - step, 0, window.innerHeight);
            if (activeToolRef.current === "freedraw") {
              requestAnimationFrame(() => {
                if (!freedrawStrokeRef.current) {
                  dispatchPointerEvent("pointerdown");
                  freedrawStrokeRef.current = true;
                  setDrawing(true);
                }
                dispatchPointerEvent("pointermove");
              });
            } else if (drawingRef.current) {
              requestAnimationFrame(() => dispatchPointerEvent("pointermove"));
            }
            return v;
          });
          return;
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setCy((p) => {
            const v = clamp(p + step, 0, window.innerHeight);
            if (activeToolRef.current === "freedraw") {
              requestAnimationFrame(() => {
                if (!freedrawStrokeRef.current) {
                  dispatchPointerEvent("pointerdown");
                  freedrawStrokeRef.current = true;
                  setDrawing(true);
                }
                dispatchPointerEvent("pointermove");
              });
            } else if (drawingRef.current) {
              requestAnimationFrame(() => dispatchPointerEvent("pointermove"));
            }
            return v;
          });
          return;
        case "ArrowLeft":
          e.preventDefault();
          e.stopPropagation();
          setCx((p) => {
            const v = clamp(p - step, 0, window.innerWidth);
            if (activeToolRef.current === "freedraw") {
              requestAnimationFrame(() => {
                if (!freedrawStrokeRef.current) {
                  dispatchPointerEvent("pointerdown");
                  freedrawStrokeRef.current = true;
                  setDrawing(true);
                }
                dispatchPointerEvent("pointermove");
              });
            } else if (drawingRef.current) {
              requestAnimationFrame(() => dispatchPointerEvent("pointermove"));
            }
            return v;
          });
          return;
        case "ArrowRight":
          e.preventDefault();
          e.stopPropagation();
          setCx((p) => {
            const v = clamp(p + step, 0, window.innerWidth);
            if (activeToolRef.current === "freedraw") {
              requestAnimationFrame(() => {
                if (!freedrawStrokeRef.current) {
                  dispatchPointerEvent("pointerdown");
                  freedrawStrokeRef.current = true;
                  setDrawing(true);
                }
                dispatchPointerEvent("pointermove");
              });
            } else if (drawingRef.current) {
              requestAnimationFrame(() => dispatchPointerEvent("pointermove"));
            }
            return v;
          });
          return;

        // ─── Select = click / toggle draw ────────────────────────
        case "Enter": {
          e.preventDefault();
          e.stopPropagation();

          // In freedraw mode: OK ends the current stroke and starts a new one
          if (activeTool === "freedraw") {
            if (freedrawStrokeRef.current) {
              dispatchPointerEvent("pointerup");
              freedrawStrokeRef.current = false;
              setDrawing(false);
            }
            // Start a fresh stroke at current cursor position
            requestAnimationFrame(() => {
              dispatchPointerEvent("pointerdown");
              freedrawStrokeRef.current = true;
              setDrawing(true);
            });
            return;
          }

          if (
            !drawingRef.current &&
            (activeTool === "selection" ||
              activeTool === "text" ||
              activeTool === "eraser")
          ) {
            dispatchPointerEvent("pointerdown");
            dispatchPointerEvent("pointerup");
            return;
          }

          if (drawingRef.current) {
            // Finish drawing
            dispatchPointerEvent("pointerup");
            setDrawing(false);
          } else {
            // Start drawing / select
            dispatchPointerEvent("pointerdown");
            setDrawing(true);
          }
          return;
        }

        // ─── Back = short→undo, hold→help ────────────────────────
        case "Backspace":
        case "Escape": {
          e.preventDefault();
          e.stopPropagation();
          // Start long-press timer for help on keydown
          if (!backHoldTimer.current) {
            backHoldTimer.current = setTimeout(() => {
              backHoldTimer.current = null;
              setShowHelp(true);
            }, HELP_HOLD_MS);
          }
          return;
        }

        // ─── Menu = tool ring ────────────────────────────────────
        case "ContextMenu": {
          e.preventDefault();
          setShowToolRing((p) => !p);
          return;
        }

        // ─── Rewind / FF = cycle tools ──────────────────────────
        case "MediaRewind": {
          e.preventDefault();
          endFreedrawStroke();
          cycleTool(-1);
          return;
        }
        case "MediaFastForward": {
          e.preventDefault();
          endFreedrawStroke();
          cycleTool(1);
          return;
        }

        // ─── Play/Pause = toggle select ↔ draw, or Select All ──
        case "MediaPlayPause": {
          e.preventDefault();
          if (activeTool === "selection") {
            // Already on selection → select all elements
            selectAll();
          } else {
            // Any other tool → switch to selection
            endFreedrawStroke();
            pickTool(0);
          }
          return;
        }

        // ─── Number keys for quick tool select (works on BT keyboard) ─
        default: {
          const num = parseInt(e.key, 10);
          if (!isNaN(num) && num >= 0 && num <= TOOL_CYCLE.length) {
            e.preventDefault();
            pickTool(num === 0 ? TOOL_CYCLE.length - 1 : num - 1);
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      delete heldKeys.current[e.key];

      // End freedraw stroke when all arrow keys are released
      if ((ARROW_KEYS as readonly string[]).includes(e.key)) {
        const anyArrowHeld = (ARROW_KEYS as readonly string[]).some(
          (k) => k in heldKeys.current,
        );
        if (!anyArrowHeld && activeToolRef.current === "freedraw") {
          endFreedrawStroke();
        }
      }

      // Back key released: if timer still active it was a short press → undo
      if (e.key === "Backspace" || e.key === "Escape") {
        if (backHoldTimer.current) {
          clearTimeout(backHoldTimer.current);
          backHoldTimer.current = null;
          // Short press = undo / cancel
          if (freedrawStrokeRef.current) {
            dispatchPointerEvent("pointerup");
            freedrawStrokeRef.current = false;
            setDrawing(false);
            undo();
          } else if (drawingRef.current) {
            dispatchPointerEvent("pointerup");
            setDrawing(false);
            undo();
          } else {
            undo();
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      if (backHoldTimer.current) {
        clearTimeout(backHoldTimer.current);
      }
    };
  }, [
    showToolRing,
    showHelp,
    activeTool,
    cycleTool,
    pickTool,
    dispatchPointerEvent,
    undo,
    selectAll,
    endFreedrawStroke,
  ]);

  // ── Sync tool when Excalidraw changes it internally ──────────────────

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const check = () => {
      const st = excalidrawAPI.getAppState();
      const t = st.activeTool?.type;
      if (t) {
        const idx = TOOL_CYCLE.indexOf(t as ToolType);
        if (idx >= 0) {
          setToolIdx(idx);
        }
      }
    };
    const id = setInterval(check, 500);
    return () => clearInterval(id);
  }, [excalidrawAPI]);

  // End any active freedraw stroke when tool changes away from freedraw
  useEffect(() => {
    if (activeTool !== "freedraw") {
      endFreedrawStroke();
    }
  }, [activeTool, endFreedrawStroke]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%" }}
    >
      {children}

      {/* Virtual Cursor */}
      <VirtualCursor x={cx} y={cy} drawing={drawing} />

      {/* Bottom HUD */}
      <ToolHUD activeTool={activeTool} toolIdx={toolIdx} drawing={drawing} />

      {/* Tool ring overlay */}
      {showToolRing && (
        <ToolRing
          activeIdx={toolIdx}
          onPick={pickTool}
          onHelp={() => { setShowToolRing(false); setShowHelp(true); }}
        />
      )}

      {/* Help overlay */}
      {showHelp && (
        <HelpOverlay onClose={() => setShowHelp(false)} />
      )}
    </div>
  );
}

// ── Virtual Cursor ───────────────────────────────────────────────────────

function VirtualCursor({
  x,
  y,
  drawing,
}: {
  x: number;
  y: number;
  drawing: boolean;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: x - CURSOR_SIZE / 2,
        top: y - CURSOR_SIZE / 2,
        width: CURSOR_SIZE,
        height: CURSOR_SIZE,
        borderRadius: "50%",
        border: `3px solid ${drawing ? "#e03131" : "#228be6"}`,
        backgroundColor: drawing
          ? "rgba(224,49,49,0.18)"
          : "rgba(34,139,230,0.12)",
        pointerEvents: "none",
        zIndex: 999999,
        transition: "left 60ms linear, top 60ms linear",
        boxShadow: drawing
          ? "0 0 12px rgba(224,49,49,0.5)"
          : "0 0 8px rgba(34,139,230,0.35)",
      }}
    >
      {/* Crosshair */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 2,
          height: 10,
          marginLeft: -1,
          marginTop: -5,
          backgroundColor: drawing ? "#e03131" : "#228be6",
          borderRadius: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 10,
          height: 2,
          marginLeft: -5,
          marginTop: -1,
          backgroundColor: drawing ? "#e03131" : "#228be6",
          borderRadius: 1,
        }}
      />
    </div>
  );
}

// ── Tool HUD (bottom bar) ────────────────────────────────────────────────

function ToolHUD({
  activeTool,
  toolIdx,
  drawing,
}: {
  activeTool: string;
  toolIdx: number;
  drawing: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(8px)",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 15,
        zIndex: 999998,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* Left: tool info */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            background: "#228be6",
            borderRadius: 6,
            padding: "3px 10px",
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 0.5,
          }}
        >
          {toolIdx + 1}/{TOOL_CYCLE.length}
        </span>
        <span style={{ fontWeight: 600 }}>
          {TOOL_LABELS[activeTool] ?? activeTool}
        </span>
        {drawing && (
          <span
            style={{
              color: "#ff6b6b",
              fontWeight: 700,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            ● Drawing
          </span>
        )}
      </div>

      {/* Right: control hints */}
      <div
        style={{
          display: "flex",
          gap: 18,
          fontSize: 12,
          opacity: 0.8,
        }}
      >
        {activeTool === "freedraw" ? (
          <span style={{ color: "#69db7c", fontWeight: 600 }}>✏ D-pad draws · OK lifts pen · Back undoes</span>
        ) : activeTool === "selection" ? (
          <>
            <span>⏯ Play/Pause: Select All</span>
            <span>OK: Click</span>
            <span>◀▶ FF/Rew: Cycle</span>
            <span>☰ Menu: Tools</span>
          </>
        ) : (
          <>
            <span>◀▶ Rewind/FF: Cycle</span>
            <span>OK: Place/Confirm</span>
            <span>☰ Menu: Tools</span>
          </>
        )}
        <span style={{ opacity: 0.5 }}>Hold Back → Help</span>
      </div>
    </div>
  );
}

// ── Tool Ring Overlay ────────────────────────────────────────────────────

function ToolRing({
  activeIdx,
  onPick,
  onHelp,
}: {
  activeIdx: number;
  onPick: (idx: number) => void;
  onHelp: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 999999,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: 16,
          borderRadius: 16,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {TOOL_CYCLE.map((tool, i) => (
          <button
            key={tool}
            onClick={() => onPick(i)}
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              border:
                i === activeIdx
                  ? "3px solid #228be6"
                  : "2px solid rgba(255,255,255,0.2)",
              background:
                i === activeIdx
                  ? "rgba(34,139,230,0.25)"
                  : "rgba(255,255,255,0.06)",
              color: "#fff",
              fontSize: 11,
              fontWeight: i === activeIdx ? 700 : 400,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              cursor: "pointer",
              transition: "all 150ms ease",
              transform: i === activeIdx ? "scale(1.12)" : "scale(1)",
            }}
          >
            <span style={{ fontSize: 22 }}>{toolEmoji(tool)}</span>
            <span>{TOOL_LABELS[tool]}</span>
          </button>
        ))}
      </div>

      {/* Help button */}
      <button
        onClick={onHelp}
        style={{
          background: "rgba(255,255,255,0.1)",
          border: "2px solid rgba(255,255,255,0.3)",
          borderRadius: 10,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          padding: "8px 24px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        ℹ️ How to use Fire TV controls
      </button>

      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          fontSize: 14,
        }}
      >
        ◀ ▶ to browse &nbsp;·&nbsp; OK to select &nbsp;·&nbsp; Back to close
      </div>
    </div>
  );
}

function toolEmoji(tool: string): string {
  switch (tool) {
    case "selection":
      return "👆";
    case "rectangle":
      return "⬜";
    case "diamond":
      return "◇";
    case "ellipse":
      return "⭕";
    case "arrow":
      return "➡️";
    case "line":
      return "⁄";
    case "freedraw":
      return "✏️";
    case "text":
      return "T";
    case "eraser":
      return "🧹";
    default:
      return "?";
  }
}

// ── Help Overlay ──────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    title: "Navigation & Drawing",
    rows: [
      { button: "⬆ ⬇ ⬅ ➡️  D-pad", action: "Move cursor on canvas" },
      { button: "OK / Select", action: "Click — start shape, confirm, or select element" },
      { button: "OK (in ✏️ Pencil)", action: "Lift pen — end current stroke, start new one" },
      { button: "D-pad (in ✏️ Pencil)", action: "Draw continuously — just move the D-pad!" },
      { button: "Back (short press)", action: "Undo last action" },
      { button: "Back (hold 0.6s)", action: "Open this Help screen" },
    ],
  },
  {
    title: "Tools",
    rows: [
      { button: "⏪ Rewind", action: "Previous tool" },
      { button: "⏩ Fast Forward", action: "Next tool" },
      { button: "☰ Menu", action: "Open tool picker ring" },
      { button: "⏯ Play/Pause (on Select tool)", action: "Select All elements (Ctrl+A)" },
      { button: "⏯ Play/Pause (on any other tool)", action: "Switch to Selection tool" },
      { button: "Number keys 1–9", action: "Jump directly to that tool (Bluetooth keyboard)" },
    ],
  },
  {
    title: "Tool Reference",
    rows: TOOL_CYCLE.map((t, i) => ({
      button: `${i + 1}  ${toolEmoji(t)}  ${TOOL_LABELS[t]}`,
      action: toolHint(t),
    })),
  },
];

function toolHint(tool: string): string {
  switch (tool) {
    case "selection": return "Click to select · drag to multi-select · Play/Pause = Select All";
    case "rectangle": return "OK starts, D-pad sizes the shape, OK confirms";
    case "diamond":   return "Same as rectangle, produces a rotated diamond";
    case "ellipse":   return "Same as rectangle, produces a circle/ellipse";
    case "arrow":     return "OK starts, D-pad draws, OK places end point";
    case "line":      return "OK starts, D-pad draws, OK places end point";
    case "freedraw":  return "Move D-pad to draw — pen is always down. OK lifts/restarts pen";
    case "text":      return "OK places a text box, virtual keyboard opens";
    case "eraser":    return "Move over elements and OK to erase";
    default:          return "";
  }
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(8px)",
        zIndex: 9999999,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: "40px 60px 80px",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
      }}
    >
      <div style={{ maxWidth: 900, width: "100%" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -0.5 }}>
            📺  Fire TV Remote Controls
          </div>
          <div style={{ fontSize: 16, opacity: 0.6, marginTop: 8 }}>
            Press any button to close
          </div>
        </div>

        {HELP_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "#74c0fc",
                marginBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                paddingBottom: 6,
              }}
            >
              {section.title}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {section.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      background: i % 2 === 0 ? "rgba(255,255,255,0.04)" : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 14px",
                        fontWeight: 700,
                        fontSize: 15,
                        whiteSpace: "nowrap",
                        color: "#ffd43b",
                        width: "34%",
                        borderRadius: "6px 0 0 6px",
                      }}
                    >
                      {row.button}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontSize: 15,
                        opacity: 0.9,
                        borderRadius: "0 6px 6px 0",
                      }}
                    >
                      {row.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ textAlign: "center", opacity: 0.45, fontSize: 13, marginTop: 16 }}>
          Excalidraw for Fire TV · Hold Back to open this screen anytime
        </div>
      </div>
    </div>
  );
}