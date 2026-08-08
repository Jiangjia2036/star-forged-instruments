function Controls({
  volume,
  setVolume,
  effectStrength,
  setEffectStrength,
  selectedEffect,
  setSelectedEffect,
}) {
  function handleEffectClick(effect) {
    if (selectedEffect === effect) {
      setSelectedEffect("");
    } else {
      setSelectedEffect(effect);
    }
  }

  return (
    <section className="controls-section">
      <h2>Controls</h2>

      <div className="controls">
        <button
          className={
            selectedEffect === "Warp"
              ? "active"
              : ""
          }
          onClick={() =>
            handleEffectClick("Warp")
          }
        >
          Warp
        </button>

        <button
          className={
            selectedEffect === "Echo"
              ? "active"
              : ""
          }
          onClick={() =>
            handleEffectClick("Echo")
          }
        >
          Echo
        </button>

        <button
          className={
            selectedEffect === "Chorus"
              ? "active"
              : ""
          }
          onClick={() =>
            handleEffectClick("Chorus")
          }
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
          onChange={(e) =>
            setEffectStrength(
              Number(e.target.value)
            )
          }
        />
      </div>

      <div className="slider">
        <label>Volume</label>

        <input
          type="range"
          min="-40"
          max="0"
          value={volume}
          onChange={(e) =>
            setVolume(
              Number(e.target.value)
            )
          }
        />
      </div>
    </section>
  );
}

export default Controls;