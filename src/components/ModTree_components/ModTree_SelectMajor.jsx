import react from 'react'

export default function SelectMajor({ selectedMajor, onMajorChange }) {
    return (
        <div style={{
            padding: '20px',
            fontFamily: 'sans-serif',
            marginBottom: '24px',
            color: '#1a1a18',
            backgroundColor: '#ffffff',
            border: '1px solid #d1d5db',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            width: '100%'
        }}>
            <h1 style={{ color: '#F76F44', fontWeight: '700', fontSize: '24px', margin: '0 0 12px 0' }}>What<span style={{ color: '#2564F8' }}>To</span>Mod</h1>
            <label style={{ display: 'block', marginBottom: '10px', color: '#4B5563', fontWeight: '600', fontSize: '14px' }}>Choose your Major</label>
            <select value={selectedMajor} onChange={(e) => onMajorChange(e.target.value)} style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '12px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                color: '#111827',
                fontFamily: 'inherit',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
                textAlign: 'center',
                textAlignLast: 'center'
            }}>
                <option value="Empty-Major" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>-</option>
                <option value="Artificial Intelligence" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Artificial Intelligence</option>
                <option value="Business Artificial Intelligence Systems" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Business Artificial Intelligence Systems</option>
                <option value="BZA-Major" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Business Analytics</option>
                <option value="Chemical Engineering" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Chemical Engineering</option>
                <option value="Chemistry" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Chemistry</option>
                <option value="Civil Engineering" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Civil Engineering</option>
                <option value="Computer Engineering" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Computer Engineering</option>
                <option value="Computer Science" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Computer Science</option>
                <option value="Data Science and Analytics" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Data Science & Analytics</option>
                <option value="Data Science and Economics" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Data Science & Economics</option>
                <option value="Environmental and Sustainability Engineering" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Environmental and Sustainability Engineering</option>
                <option value="Electrical Engineering" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Electrical Engineering</option>
                <option value="Engineering Science" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Engineering Science</option>
                <option value="Economics" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Economics</option>
                <option value="Industrial and Systems Engineering" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Industrial and Systems Engineering</option>
                <option value="Information Security" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Information Security</option>
                <option value="Life Sciences" style={{ backgroundColor: '#ffffff', textAlign: 'center', color: '#111827' }}>Life Sciences</option>
            </select>
        </div>
    )
}
