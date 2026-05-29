import { useState } from 'react'
import { rawSupabaseData } from './MockModuleDatabase';

//Create dictionary key-value pair for efficient Module finding
const moduleDatabase = Object.fromEntries(rawSupabaseData.map(mod => [mod.id, mod]));


// Create array sorted by Module Level
const modulesByLvl = [1000, 2000, 3000, 4000].map(lvl => 
  rawSupabaseData.filter(mod => mod.level === lvl)
);

function ModuleButton({ moduleCode }) {
  const matchedModule = moduleDatabase[moduleCode];

  if (!matchedModule) 
    return 
    <button disabled>
      Unknown
    </button>; //Unlikely to encounter as all moduleCode is from moduleDatabase, there is no user input

  return (
    <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block' }}>
      <button style={{ padding: '10px 16px', cursor: 'pointer' }}>
        {matchedModule.label}
      </button>
    </div>
  );
}



export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
      {modulesByLvl.map((layer, layerIndex) => (
        // Number of Columns
        <div key={layerIndex} style={{ display: 'flex', flexDirection: 'column', gap: '30px'}}>
          <div style={{ color: 'white', textAlign: 'center' }}>Level {(layerIndex + 1)}000 Modules</div> 
    
          {layer.map((modInTree) => (
            //Within each column
            <div key={modInTree.id} style={{ justifyContent: 'center', alignItems: 'center', flex:1}}>
              {/* Button retains autonomy; it pulls what it needs using the ID */}
              <ModuleButton moduleCode={modInTree.id} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
