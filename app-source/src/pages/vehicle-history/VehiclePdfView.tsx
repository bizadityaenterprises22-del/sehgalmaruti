import { useEffect, useRef, useState, type RefObject, type SyntheticEvent } from "react";

/*
  The exact Maruti-look page view: the renderer's HTML in an iframe, drawn at its real size
  (778pt = 1038px wide) and shrunk to fit the box width when the box is narrower. Nothing in the
  report itself is changed - this only scales the frame. The box scrolls inside itself; on a phone
  it can be pinch-zoomed (browser) or stepped with the - / Fit / + buttons, which work even in a
  WebView that has pinch-zoom switched off.
*/

const PAGE_PX = 1038;
const STEPS = [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 2.5];

export function PdfView({
  html,
  title,
  frameRef,
  phone,
  onFrameLoad,
}: {
  html: string;
  title: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  phone: boolean;
  onFrameLoad?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [docH, setDocH] = useState(1400);
  const [zoom, setZoom] = useState<number | null>(null); // null = fit the width

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = width > 0 ? Math.min(1, width / PAGE_PX) : 1;
  const k = zoom ?? fit;

  function loaded(e: SyntheticEvent<HTMLIFrameElement>) {
    const body = e.currentTarget.contentDocument?.body;
    if (body) setDocH(Math.max(200, Math.ceil(body.getBoundingClientRect().height)));
    onFrameLoad?.();
  }
  const zoomIn = () => setZoom(STEPS.find((s) => s > k + 0.01) ?? STEPS[STEPS.length - 1]);
  const zoomOut = () => setZoom([...STEPS].reverse().find((s) => s < k - 0.01) ?? STEPS[0]);

  const btn =
    "grid h-11 min-w-[44px] place-items-center rounded-lg border border-ink/40 bg-raised px-3 text-[15px] font-extrabold text-ink shadow-md hover:bg-surface";

  return (
    <div className="relative h-full">
      <div ref={boxRef} className="absolute inset-0 overflow-auto bg-[#525659]" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
        <div style={{ width: PAGE_PX * k, height: docH * k, margin: "0 auto" }}>
          <iframe
            ref={frameRef}
            title={title}
            srcDoc={html}
            onLoad={loaded}
            // No scripts run inside the report. allow-same-origin lets this page call print() on it
            // and read its height; allow-modals lets the browser open its print box.
            sandbox="allow-same-origin allow-modals"
            scrolling="no"
            style={{ width: PAGE_PX, height: docH, border: 0, transform: `scale(${k})`, transformOrigin: "0 0", display: "block" }}
          />
        </div>
      </div>
      {phone ? (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button type="button" className={btn} onClick={zoomOut} aria-label="Zoom out">
            −
          </button>
          <button type="button" className={btn} onClick={() => setZoom(null)} aria-label="Fit page to width">
            Fit {Math.round(k * 100)}%
          </button>
          <button type="button" className={btn} onClick={zoomIn} aria-label="Zoom in">
            +
          </button>
        </div>
      ) : null}
    </div>
  );
}
