import { SOUND_PROFILES, EFFECTS, DESIGN_NOTES } from "../band";

function InstrumentPage() {
  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">The Instrument</h2>
        <p className="page-sub">
          A hand built synthesiser running on a Raspberry Pi Pico 2 W. Three
          keys, any octave, any key signature, wired to this page over USB.
        </p>
      </div>

      <div className="panel">
        <h3 className="panel-title">Sound profiles</h3>

        <div className="card-grid">
          {SOUND_PROFILES.map((profile) => (
            <article key={profile.name} className="card">
              <div className="card-tag">{profile.kind}</div>
              <h4 className="card-title">{profile.name}</h4>
              <p className="card-body">{profile.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Effects</h3>

        <div className="card-grid">
          {EFFECTS.map((effect) => (
            <article key={effect.name} className="card">
              <div className="card-tag">{effect.control}</div>
              <h4 className="card-title">{effect.name}</h4>
              <p className="card-body">{effect.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Design choices</h3>

        <div className="note-list">
          {DESIGN_NOTES.map((note) => (
            <article key={note.title} className="note">
              <h4 className="note-title">{note.title}</h4>
              <p className="card-body">{note.body}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">How it connects</h3>

        <div className="signal-flow">
          <span className="flow-step">Button</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">Pico</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">USB serial</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">This page</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">Lights + visuals</span>
        </div>

        <p className="card-body">
          Pressing a key sends a plain text line such as{" "}
          <code>NOTE_C4_ON</code> over the USB cable. The page lights the
          matching key in its own colour and drives the starfield behind
          everything. Nothing is pre-recorded — the visuals only move when the
          instrument does.
        </p>
      </div>
    </div>
  );
}

export default InstrumentPage;
