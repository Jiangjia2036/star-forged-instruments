const EFFECTS = ["Warp", "Echo", "Chorus"];

function Controls({
  effectStrength,
  setEffectStrength,
  selectedEffect,
  setSelectedEffect,
  picoEcho = false,
  potVolume = 0,
  picoConnected = false,
  sustain = false,
  onToggleSustain,
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
        {EFFECTS.map((effect) => {
          // Echo also lights when the GP19 switch is thrown, so the button
          // reflects what the instrument is actually doing rather than only
          // what was clicked here.
          const lit =
            selectedEffect === effect ||
            (effect === "Echo" && picoEcho);

          return (
            <button
              key={effect}
              className={lit ? "fx-btn active" : "fx-btn"}
              onClick={() => handleEffectClick(effect)}
            >
              {effect}
            </button>
          );
        })}
      </div>

      <div className="divider" />

      {/* Mirrors the GP20 damper switch. Lit whichever way it was engaged. */}
      <button
        className={sustain ? "fx-btn sustain-btn on" : "fx-btn sustain-btn"}
        onClick={onToggleSustain}
        title="Damper pedal - released keys ring out"
      >
        Sustain
      </button>

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

      {/* Read only. The potentiometer is the only volume control - this bar
          just follows the knob so the screen always matches the hardware. */}
      <div className="slider">
        <span className="label">Volume</span>

        <div
          className="vol-meter"
          title={
            picoConnected
              ? "Set by the potentiometer on the instrument"
              : "Connect the Pico to read the volume knob"
          }
        >
          <div
            className="vol-meter-fill"
            style={{ width: (picoConnected ? potVolume : 0) + "%" }}
          />
        </div>

        <span className="vol-readout">
          {picoConnected ? potVolume + "%" : "--"}
        </span>
      </div>
    </section>
  );
}

export default Controls;
