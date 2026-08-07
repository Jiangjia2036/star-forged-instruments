function Keyboard() {

  const notes = ["C", "D", "E", "F", "G", "A", "B", "C"];

  return (
    <div>
      <h2>Keyboard</h2>

      {notes.map((note) => (
        <button key={note}>
          {note}
        </button>
      ))}

    </div>
  );
}

export default Keyboard;