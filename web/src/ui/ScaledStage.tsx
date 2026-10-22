import { useEffect, useRef, useState, type ReactNode } from "react";

/** Lays out broadcast graphics on a fixed 1280x720 canvas and scales the whole thing to
 *  fit, like a real graphics engine, so overlays keep their proportions at any size. */
export function ScaledStage({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = outer.current!;
    const fit = () => setScale(el.clientWidth / 1280);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={outer} className="stage-wrap">
      <div className="stage-1280" style={{ transform: `scale(${scale})` }}>{children}</div>
    </div>
  );
}
