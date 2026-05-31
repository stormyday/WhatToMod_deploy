import React from 'react'
import { rawSupabaseData } from '../assets/MockModuleDatabase'

// Create dictionary key-value pair for efficient Module finding
const moduleDatabase = rawSupabaseData.reduce((acc, mod) => {
    if (!acc[mod.id]) acc[mod.id] = mod

    if (mod.isPillar) {
        mod.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option
        })
    }

    if (mod.isLevel4000Pathway) {
        mod.optionA.basket1.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option
        })
        mod.optionA.basket2.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option
        })
        mod.optionB.options.forEach(option => {
            if (!acc[option.id]) acc[option.id] = option
        })
    }

    return acc
}, {})

export default function ModuleButton({ moduleCode, isSelected, isCompulsory, onToggle }) {
    const matchedModule = moduleDatabase[moduleCode]
    if (!matchedModule) return <button disabled>Unknown</button>

    return (
        <div className="tooltip-container" style={{ position: 'relative', display: 'inline-block' }}>
            <button onClick={onToggle} title={matchedModule.description}
                style={{ 
                    padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', 
                    backgroundColor: isCompulsory ? '#C6F2BF' : '#fac9a5', // Dynamic color toggle
                    color: 'black',
                    border: isSelected ? '2px solid #222324' : '1px solid white', 
                    opacity: isSelected ? 1 : 0.6,
                    transition: 'all 0.1s ease-in-out'
                }}>
                {matchedModule.label}
            </button>
        </div>
    )
}