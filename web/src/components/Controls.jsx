const EFFECTS = ["Warp", "Echo", "Chorus"];

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
    <section className="console">
      <div className="fx-group">
        {EFFECTS.map((effect) => (
          <button
            key={effect}
            className={
              selectedEffect === effect
                ? "fx-btn active"
                : "fx-btn"
            }
            onClick={() => handleEffectClick(effect)}
          >
            {effect}
          </button>
        ))}
      </div>

      <div className="divider" />

      <div className="slider">
        <span className="label">Depth</span>

        <input
          type="range"
          min="0"
          max="100"
          value={effectStrength}
          onChange={(e) =>
            setEffectStrength(Number(e.target.value))
          }
        />
      </div>

      <div className="divider" />

      <div className="slider">
        <span className="label">Volume</span>

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
