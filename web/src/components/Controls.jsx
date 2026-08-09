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
    setSelectedEffect(selectedEffect === effect ? "" : effect);
  }

  return (
    <section className="console">
      <div className="fx-group">
        {EFFECTS.map((effect) => {
          // With a board connected, the Echo light shows the board's actual
          // echo state - the physical switch and the on-screen click both
          // land there, and the board reports every change back. Without a
          // board it falls back to the local selection.
          const lit =
            effect === "Echo" && picoConnected
              ? picoEcho
              : selectedEffect === effect;

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
          onChange={(e) => setEffectStrength(Number(e.target.value))}
        />
      </div>

      <div className="divider" />

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
