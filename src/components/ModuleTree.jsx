import { useState } from 'react';
import { rawSupabaseData } from '../assets/MockModuleDatabase';
import SelectMajor from './ModTree_SelectMajor';
import ModuleTree from './ModTree_ModTree';
import SelectedBasket from './ModTree_SelectionBasket';

// Global complete dictionary map used specifically for the selection basket lookups
// Preserve top-level module metadata while including pillar and Level 4000 pathway options.
const moduleDatabase = rawSupabaseData.reduce((acc, mod) => {
    if (!acc[mod.id]) acc[mod.id] = mod;

    if (mod.isPillar) {
        mod.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option;
        });
    }

    if (mod.isLevel4000Pathway) {
        mod.optionA.basket1.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option;
        });
        mod.optionA.basket2.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option;
        });
        mod.optionB.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option;
        });
    }

    return acc;
}, {});

export default function App() {
    const [selectedMajor, setSelectedMajor] = useState('Empty-Major');
    const [selectedMods, setSelectedMods] = useState([]);

    const handleToggleModule = (modId) => {
        setSelectedMods((currentList) => 
            currentList.includes(modId) ? currentList.filter(id => id !== modId) : [...currentList, modId]
        );
    };

    const filteredModules = rawSupabaseData.filter(mod => 
        mod.majors && mod.majors.includes(selectedMajor)
    );

    const modulesByLvl = [1000, 2000, 3000, 4000].map(lvl => 
        filteredModules.filter(mod => mod.level === lvl)
    );

    return (
        <div className="min-h-screen bg-[#F6EDDC]">
        <div style={{ fontFamily: 'sans-serif', padding: '20px', backgroundColor: '#F6EDDC' }}>
            <SelectMajor selectedMajor={selectedMajor} onMajorChange={setSelectedMajor} />

            {selectedMajor !== 'Empty-Major' ? (
                <ModuleTree 
                    modulesByLvl={modulesByLvl} 
                    selectedMods={selectedMods} 
                    selectedMajor={selectedMajor}
                    onToggleModule={handleToggleModule} 
                />
            ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontStyle: 'italic' }}>
                    Please select a major from the dropdown above to display your graduation pathway tree.
                </div>
            )}
        </div>

        <hr />

        {/* Modular Selection Basket Component */}
        <SelectedBasket 
            selectedMods={selectedMods}
            selectedMajor={selectedMajor}
            moduleDatabase={moduleDatabase}
            onToggleModule={handleToggleModule}
        />
        </div>
    );
}