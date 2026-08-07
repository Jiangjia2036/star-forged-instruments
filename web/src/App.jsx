import "./App.css";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";
import Status from "./components/Status";

function App() {
  return (
    <div className="app">

      <h1>Star Forged Instruments</h1>

      <Keyboard />

      <Controls />

    </div>
  );
}

export default App;