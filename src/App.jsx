import Signup from "./components/Signup";
import ModuleTree from "./components/ModuleTree";
import Insights from "./components/SentAnalysis/Insights";
import { useState } from "react";

function App() {
  const [currentFeature, setCurrentFeature] = useState('one')
  return (
    <>
    <nav>
      /* 1. BUTTONS: These ONLY change the state variable when clicked */
      <button onClick={() => setCurrentFeature('one')}>View Signup Feature</button>
      <button onClick={() => setCurrentFeature('two')}>View ModuleTree Feature</button>
    </nav>

    <main>
      {currentFeature === 'one' && <Signup />}
      {currentFeature === 'two' && <ModuleTree />}
    </main>
  </>
  )
}

export default App
