import { useState, useEffect } from 'react';
import Select from 'react-select';
import { useNavigate } from "react-router-dom";
import { supabase } from '../supabaseClient';
import { LuUser } from 'react-icons/lu';
import "@fontsource/league-spartan/700.css";

const GRADES = [
  "A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D+", "D", "F",
].map(g => ({ value: g, label: g }));

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '54px',
    borderRadius: '0.75rem',
    backgroundColor: '#F9FAFB',
    borderColor: state.isFocused ? '#1D63ED' : '#D1D5DB',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(29, 99, 237, 0.2)' : 'none',
    '&:hover': { borderColor: '#1D63ED' },
  }),
  valueContainer: (base) => ({ ...base, padding: '2px 14px' }),
  placeholder: (base) => ({ ...base, color: '#9CA3AF' }),
  singleValue: (base) => ({ ...base, color: '#111827', fontWeight: 500 }),
  menu: (base) => ({ ...base, borderRadius: '0.75rem', overflow: 'hidden', zIndex: 20 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? '#2564F8' : state.isFocused ? '#EFF4FF' : 'white',
    color: state.isSelected ? 'white' : '#111827',
    cursor: 'pointer',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
};

function FieldLabel({ children, optional }) {
  return (
    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
      {children}
      {optional && (
        <span className="text-gray-400 font-medium normal-case tracking-normal ml-1">
          (optional)
        </span>
      )}
    </label>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ major: '', second_major: '', minor: '' });
  const [grades, setGrades] = useState([]);
  const [moduleOptions, setModuleOptions] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Course option lists fetched from Supabase
  const [majorOptions, setMajorOptions] = useState([]);
  const [secondMajorOptions, setSecondMajorOptions] = useState([]);
  const [minorOptions, setMinorOptions] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  // Fetch programmes / minors / second majors from Supabase
  useEffect(() => {
    async function fetchCourses() {
      const { data, error } = await supabase
        .from('courses')
        .select('name, type')
        .order('name');

      if (error) {
        console.error('Error fetching courses:', error);
      } else {
        setMajorOptions(
          data.filter(c => c.type === 'programme').map(c => ({ value: c.name, label: c.name }))
        );
        setSecondMajorOptions(
          data.filter(c => c.type === 'second_major').map(c => ({ value: c.name, label: c.name }))
        );
        setMinorOptions(
          data.filter(c => c.type === 'minor').map(c => ({ value: c.name, label: c.name }))
        );
      }
      setCoursesLoading(false);
    }

    fetchCourses();
  }, []);

  // Fetch NUSMods module list for the Past Grades picker
  useEffect(() => {
    fetch('https://api.nusmods.com/v2/2025-2026/moduleList.json')
      .then(res => res.json())
      .then(data => {
        const options = data.map(mod => ({
          value: mod.moduleCode,
          label: `${mod.moduleCode} - ${mod.title}`,
        }));
        setModuleOptions(options);
      })
      .finally(() => setModulesLoading(false));
  }, []);

  // Load existing profile from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          major: data.major || '',
          second_major: data.second_major || '',
          minor: data.minor || '',
        });
        setGrades(data.past_grades || []);
      }
    };

    fetchProfile();
  }, []);

  const addGradeRow = () => setGrades([...grades, { moduleCode: '', grade: '' }]);
  const removeGradeRow = (index) => setGrades(grades.filter((_, i) => i !== index));
  const updateGradeRow = (index, key, value) => {
    const next = [...grades];
    next[index] = { ...next[index], [key]: value };
    setGrades(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setSaveStatus('error');
      return;
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      ...profile,
      past_grades: grades,
    });

    if (error) {
      console.error("Supabase Save Error:", error);
    }

    setSaving(false);
    setSaveStatus(error ? 'error' : 'success');
  };

  const programmeValue = (key) =>
    profile[key] ? { value: profile[key], label: profile[key] } : null;

  return (
    <div className="min-h-screen bg-[#F6EDDC]">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <h1
          className="cursor-pointer text-[#F76F44]"
          style={{ fontFamily: "League Spartan", fontWeight: 700 }}
          onClick={() => navigate("/dashboard")}
        >
          What<span style={{ color: "#2564F8" }}>To</span>Mod
        </h1>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl px-4 py-3 transition"
        >
          ← Back
        </button>
      </header>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-8 py-12">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-[#2564F8]">
            <LuUser size={30} />
            My Profile
          </h2>
          <p className="text-sm text-gray-500 mt-1">Manage your academic information</p>
        </div>

        {/* Academic Details */}
        <div className="bg-white rounded-2xl border border-gray-200 px-7 py-6 mb-6">
          <h3 className="text-base font-bold text-gray-800 mb-5">Academic Details</h3>

          <div className="grid grid-cols-1 gap-5">
            <div>
              <FieldLabel>Primary Major<span className="text-[#FF0000]">*</span></FieldLabel>
              <Select
                options={majorOptions}
                styles={selectStyles}
                placeholder="e.g. Computer Science"
                isClearable
                isLoading={coursesLoading}
                value={programmeValue('major')}
                onChange={(selected) => setProfile({ ...profile, major: selected?.value || '' })}
              />
            </div>

            <div>
              <FieldLabel optional>Second Major</FieldLabel>
              <Select
                options={secondMajorOptions}
                styles={selectStyles}
                placeholder="e.g. Economics"
                isClearable
                isLoading={coursesLoading}
                value={programmeValue('second_major')}
                onChange={(selected) => setProfile({ ...profile, second_major: selected?.value || '' })}
              />
            </div>

            <div>
              <FieldLabel optional>Minor</FieldLabel>
              <Select
                options={minorOptions}
                styles={selectStyles}
                placeholder="e.g. Statistics"
                isClearable
                isLoading={coursesLoading}
                value={programmeValue('minor')}
                onChange={(selected) => setProfile({ ...profile, minor: selected?.value || '' })}
              />
            </div>
          </div>
        </div>

        {/* Past Grades */}
        <div className="bg-white rounded-2xl border border-gray-200 px-7 py-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-800">Past Grades</h3>
            <button
              onClick={addGradeRow}
              className="text-sm font-semibold text-white bg-[#2564F8] hover:bg-[#1d4fd1] rounded-xl px-4 py-2.5 transition"
            >
              + Add Module
            </button>
          </div>

          {grades.length === 0 && (
            <p className="text-sm text-gray-400">
              No modules added yet. Click "+ Add Module" to get started.
            </p>
          )}

          <div className="space-y-3">
            {grades.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1">
                  <Select
                    options={moduleOptions}
                    styles={selectStyles}
                    isLoading={modulesLoading}
                    placeholder="Select module..."
                    value={
                      item.moduleCode
                        ? moduleOptions.find(o => o.value === item.moduleCode) || { value: item.moduleCode, label: item.moduleCode }
                        : null
                    }
                    onChange={(selected) => updateGradeRow(index, 'moduleCode', selected?.value || '')}
                  />
                </div>
                <div className="w-28 shrink-0">
                  <Select
                    options={GRADES}
                    styles={selectStyles}
                    placeholder="Grade"
                    value={item.grade ? { value: item.grade, label: item.grade } : null}
                    onChange={(selected) => updateGradeRow(index, 'grade', selected?.value || '')}
                  />
                </div>
                <button
                  onClick={() => removeGradeRow(index)}
                  className="text-gray-400 hover:text-red-500 transition px-2 text-lg shrink-0"
                  aria-label="Remove module"
                  title="Remove module"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {saveStatus === 'success' && (
          <div className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 transition animate-fade-in">
            Profile saved successfully!
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 transition animate-fade-in">
            Something went wrong while saving. Please try again.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-[#E95420] hover:bg-[#d44513] text-white text-base font-bold py-3.5 px-8 rounded-xl shadow-md transition duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      </main>
    </div>
  );
}
