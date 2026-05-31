import react from 'react'

export default function SelectMajor({ selectedMajor, onMajorChange }) {
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', marginBottom: '20px', color: '#222324' }}>
            <h1 style={{ color: 'black' }}>WhatToMod</h1>
            <p>Choose your Major</p>
            <select value={selectedMajor} onChange={(e) => onMajorChange(e.target.value)}>
                <option value="Empty-Major">-</option>
                <option value="DSA-Major">Data Science & Analytics</option>
                <option value="BZA-Major">Business Analytics</option>
            </select>
        </div>
    )
}
