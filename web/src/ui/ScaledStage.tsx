import { useEffect, useRef, useState, type ReactNode } from "react";

/** Lays out broadcast graphics on a fixed 1280x720 canvas and scales the whole thing to
 *  fit, like a real graphics engine, so overlays keep their proportions at any size.
 *  fit="width": fill the container's width (Studio). fit="contain": the largest 16:9 that
 *  fits the container, centred (Fan view, full screen). */
export function ScaledStage({ children, fit = "width" }: { children: ReactNode; fit?: "width" | "contain" }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outer.current!;
    const measure = () =>
      setScale(fit === "contain" ? Math.min(el.clientWidth / 1280, el.clientHeight / 720) : el.clientWidth / 1280);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  if (fit === "contain") {
    return (
      <div ref={outer} className="stage-contain">
        <div className="stage-box" style={{ width: 1280 * scale, height: 720 * scale }}>
          <div className="stage-1280" style={{ transform: `scale(${scale})` }}>{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div ref={outer} className="stage-wrap">
      <div className="stage-1280" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
