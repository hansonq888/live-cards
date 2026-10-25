// Broadcast or coach's tablet. Whichever is not the main view plays live in a small panel in the
// corner; click the panel to swap. In tactical mode the broadcast canvas itself shrinks into that
// corner (CSS), so there is still only one 3D renderer.
import { live, useLive } from "../live/store";
import { TacticalBoard } from "./TacticalBoard";

export function BoardSwitch() {
  const tactical = useLive((s) => s.tactical);
  return tactical ? (
    <>
      <div className="board-main"><TacticalBoard /></div>
      {/* outside board-main, whose stacking context sits under the shrunken broadcast canvas */}
      <button className="board-mini-back" onClick={() => live.toggleTactical()} aria-label="Switch to the broadcast view"><span>Broadcast view</span></button>
    </>
  ) : (
    <button className="board-mini" onClick={() => live.toggleTactical()} aria-label="Switch to the tactical view">
      <TacticalBoard mini />
      <span>Tactical view</span>
    </button>
  );
}
