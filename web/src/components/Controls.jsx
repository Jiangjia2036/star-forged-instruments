import { useState } from "react";

function Controls({
  volume,
  setVolume,
  effectStrength,
  setEffectStrength,
}) {
  const [selectedEffect, setSelectedEffect] = useState("Echo");

  return (
    <section>
      <h2>Controls</h2>

      <div className="controls">
        <button
          className={selectedEffect === "Warp" ? "active" : ""}
          onClick={() => setSelectedEffect("Warp")}
        >
          Warp
        </button>

        <button
          className={selectedEffect === "Echo" ? "active" : ""}
          onClick={() => setSelectedEffect("Echo")}
        >
          Echo
        </button>

        <button
          className={selectedEffect === "Chorus" ? "active" : ""}
          onClick={() => setSelectedEffect("Chorus")}
        >
          Chorus
        </button>
      </div>

      <div className="slider">
        <label>Effect Strength</label>

        <input
          type="range"
          min="0"
          max="100"
          value={effectStrength}
          onChange={(e) => setEffectStrength(Number(e.target.value))}
        />
      </div>

      <div className="slider">
        <label>Volume</label>

        <input
          type="range"
          min="-40"
          max="0"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </section>
  );
}

export default Controls;