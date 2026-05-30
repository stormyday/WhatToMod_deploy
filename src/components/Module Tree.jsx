import { useState } from 'react'
import { rawSupabaseData } from '../assets/MockModuleDatabase';

//Create dictionary key-value pair for efficient Module finding
const moduleDatabase = Object.fromEntries(rawSupabaseData.map(mod => [mod.id, mod]));


// Create array sorted by Module Level
const modulesByLvl = [1000, 2000, 3000, 4000].map(lvl => 
  rawSupabaseData.filter(mod => mod.level === lvl)
);

function SelectMajor() {
    return(
        <div style={{ padding: '20px', fontFamily: 'sans-serif', marginBottom: '20px' }}>
        <h1>WhatToMod</h1>
        <p>Choose your Major</p>
        <select>
            <option value="Empty-Major">-</option>
            <option value="DSA-Major">Data Science & Analytics</option>
            <option value="BZA-Major">Business Analytics</option>
        </select>
        </div>
    )
}

function ModuleButton({ moduleCode, isSelected, onToggle}) {
    const matchedModule = moduleDatabase[moduleCode];

    if (!matchedModule) return<button disabled>Unknown</button>; //Unlikely to encounter as all moduleCode is from moduleDatabase, there is no user input

    return (
    <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={onToggle} title={matchedModule.description}
        style={{ padding: '10px 16px', cursor: 'pointer', backgroundColor: isSelected ? 'lightblue' : 'white', color:'black' }}>
        {matchedModule.label}
      </button>
    </div>
    );
}



export default function App() {
    const [selectedMods, setSelectedMods] = useState([]) /* Module Basket */
    const handleToggleModule = (modId) => {
    setSelectedMods((currentList) => 
        currentList.includes(modId) ? currentList.filter(id => id !== modId) : [...currentList, modId]
    );
};
    
    return (
    <>
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
        <SelectMajor/>

        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-around' }}>
        {modulesByLvl.map((layer, layerIndex) => (
            // Number of Columns
            <div key={layerIndex} style={{ display: 'flex', flexDirection: 'column', gap: '30px'}}>
            <div style={{ color: 'white', textAlign: 'center' }}>Level {(layerIndex + 1)}000 Modules</div> 
        
            {layer.map((modInTree) => {
                const isSelected = selectedMods.includes(modInTree.id);
                return (
                    //Within each column
                    <div key={modInTree.id} style={{ justifyContent: 'center', alignItems: 'center', flex:1}}>
                    {/* Button retains autonomy; it pulls what it needs using the ID */}
                    <ModuleButton moduleCode={modInTree.id} isSelected={isSelected} onToggle={() => handleToggleModule(modInTree.id)} />
                    </div>
                )
            })}
            </div>
        ))}
        </div>
    </div>

    <hr />

    <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc' }}>
        <h3>Selected Modules ({selectedMods.length})</h3>
        
        {selectedMods.length === 0 ? (
          <p style={{ color: 'gray', fontStyle: 'italic' }}>No modules selected yet.</p>
        ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {selectedMods.map(id => (
                <div key={id}>
                    <ModuleButton moduleCode={id} isSelected={true} onToggle={() => handleToggleModule(id)} />
                </div>
            ))}
            </div>
        )}
    </div>
    </>
  );
}
