function Controls() {
  return (
    <section>

      <h2>Controls</h2>

      <div className="controls">

        <button>Warp</button>

        <button>Echo</button>

        <button>Chorus</button>

      </div>

      <div className="slider">

        <label>Effect Strength</label>

        <input
          type="range"
          min="0"
          max="100"
        />

      </div>

    </section>
  );
}

export default Controls;