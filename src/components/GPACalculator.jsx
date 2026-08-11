import { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  GRADE_VALUES,
  SEMESTERS,
  SEMESTER_OPTIONS,
  fetchModuleCredits,
  loadUserModuleRecords,
  replaceUserModuleRecords,
} from '../utils/userModuleRecords';
import { fetchModuleDetail, fetchModuleList } from '../utils/api';
import { LuCalculator, LuTrash2 } from 'react-icons/lu';
import GPATrendChart from './GPATrendChart';
import "@fontsource/league-spartan/700.css";

const GRADE_POINTS = {
  "A+": 5.0, "A": 5.0, "A-": 4.5,
  "B+": 4.0, "B": 3.5, "B-": 3.0,
  "C+": 2.5, "C": 2.0,
  "D+": 1.5, "D": 1.0,
  "F": 0.0,
};

const GRADES = GRADE_VALUES.map(g => ({ value: g, label: g }));

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '48px',
    borderRadius: '0.75rem',
    backgroundColor: state.isDisabled ? '#F3F4F6' : '#F9FAFB',
    borderColor: state.isFocused ? '#1D63ED' : '#D1D5DB',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(29, 99, 237, 0.2)' : 'none',
    opacity: state.isDisabled ? 0.5 : 1,
    '&:hover': { borderColor: '#1D63ED' },
  }),
  valueContainer: (base) => ({ ...base, padding: '2px 12px' }),
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
  dropdownIndicator: (base) => ({ ...base, padding: '4px' }),
  clearIndicator: (base) => ({ ...base, padding: '4px' }),
};

export default function GpaCalculator() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [moduleOptions, setModuleOptions] = useState([]);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModuleList()
      .then((modules) => setModuleOptions(modules.map((module) => ({
        value: module.moduleCode,
        label: `${module.moduleCode} - ${module.title}`,
        title: module.title,
      }))))
      .catch((error) => console.error('Error loading NUSMods module list:', error))
      .finally(() => setModulesLoading(false));
  }, []);

  // Load saved grades
  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }

      try {
        const records = await loadUserModuleRecords(user.id);
        if (cancelled) return;
        setRows(records.map((record) => ({
          ...record,
          creditUnresolved: Boolean(record.moduleCode) && record.moduleCredit === null,
        })));
      } catch (error) {
        console.error('Error loading module records:', error);
      }
      setLoading(false);
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  const addRow = () => setRows([...rows, { moduleCode: '', grade: null, moduleCredit: null, isSu: false, semesterTaken: null, creditUnresolved: false }]);
  const removeRow = (index) => setRows(rows.filter((_, i) => i !== index));
  const updateRow = (index, key, value) => {
    const next = [...rows];
    next[index] = key === 'isSu' && value
      ? { ...next[index], isSu: true, grade: null }
      : { ...next[index], [key]: value };
    setRows(next);
  };

  const handleModuleSelect = async (index, selected) => {
    const moduleCode = selected?.value || '';
    const next = [...rows];
    next[index] = {
      ...next[index],
      moduleCode,
      title: selected?.title || '',
      moduleCredit: null,
      creditUnresolved: false,
    };
    setRows(next);

    if (!moduleCode) return;

    const applyCredit = (moduleCredit, creditUnresolved = false) => {
      setRows((current) => current.map((row, rowIndex) => (
        rowIndex === index && row.moduleCode === moduleCode
          ? { ...row, moduleCredit, creditUnresolved }
          : row
      )));
    };

    try {
      const credits = await fetchModuleCredits([moduleCode]);
      const fromCatalog = Number(credits.get(moduleCode)?.module_credit);
      if (Number.isFinite(fromCatalog)) {
        applyCredit(fromCatalog);
        return;
      }
    } catch (error) {
      console.error(`Error looking up module credit for ${moduleCode}:`, error);
    }

    try {
      const detail = await fetchModuleDetail(moduleCode);
      const fromNusmods = Number(detail.moduleCredit);
      if (Number.isFinite(fromNusmods)) {
        applyCredit(fromNusmods);
        return;
      }
    } catch (error) {
      console.error(`Error fetching module credits for ${moduleCode} from NUSMods:`, error);
    }

    applyCredit(null, true);
  };

  const { cap, countedMcs, suMcs } = useMemo(() => {
    let points = 0, mcs = 0, suMcTotal = 0;
    for (const row of rows) {
      const mc = Number(row.moduleCredit);
      if (!Number.isFinite(mc) || mc <= 0) continue;
      if (row.isSu) { suMcTotal += mc; continue; }
      if (!row.grade) continue;
      const gp = GRADE_POINTS[row.grade];
      if (gp === undefined) continue;
      points += gp * mc;
      mcs += mc;
    }
    return {
      cap: mcs > 0 ? points / mcs : null,
      countedMcs: mcs,
      suMcs: suMcTotal,
    };
  }, [rows]);

  const gpaTrend = useMemo(() => {
    const bySemester = new Map();
    for (const row of rows) {
      if (!row.semesterTaken || row.isSu || !row.grade) continue;
      const mc = Number(row.moduleCredit);
      if (!Number.isFinite(mc) || mc <= 0) continue;
      const gp = GRADE_POINTS[row.grade];
      if (gp === undefined) continue;

      const bucket = bySemester.get(row.semesterTaken) ?? { points: 0, mcs: 0 };
      bucket.points += gp * mc;
      bucket.mcs += mc;
      bySemester.set(row.semesterTaken, bucket);
    }

    let cumPoints = 0, cumMcs = 0;
    const trend = [];
    for (const semester of SEMESTERS) {
      const bucket = bySemester.get(semester);
      if (!bucket) continue;
      cumPoints += bucket.points;
      cumMcs += bucket.mcs;
      trend.push({ semester, label: semester.toUpperCase(), gpa: cumPoints / cumMcs });
    }
    return trend;
  }, [rows]);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setSaveStatus('error');
      return;
    }

    try {
      await replaceUserModuleRecords(user.id, rows);
      setSaveStatus('success');
    } catch (error) {
      console.error('Supabase Save Error:', error);
      setSaveStatus(error instanceof Error ? 'validation' : 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6EDDC]">
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

      <main className="max-w-4xl mx-auto px-8 py-12">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-[#2564F8] flex items-center gap-2">
            <LuCalculator size={26} />
            GPA Calculator
          </h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 px-7 py-8 mb-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">GPA:</p>
            <p className="text-5xl font-extrabold text-[#2564F8]">
              {cap !== null ? cap.toFixed(2) : '--'}
              <span className="text-xl font-semibold text-gray-400"> / 5.0</span>
            </p>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-800">{countedMcs}</p>
              <p className="text-xs text-gray-500 mt-1">MCs counted</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{suMcs}</p>
              <p className="text-xs text-gray-500 mt-1">MCs S/U'ed</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 px-7 py-6 mb-6">
          <h3 className="text-base font-bold text-gray-800 mb-5">GPA Trend</h3>
          <GPATrendChart data={gpaTrend} />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 px-7 py-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-800">Modules Taken</h3>
            <button
              onClick={addRow}
              disabled={loading}
              className="text-sm font-semibold text-white bg-[#2564F8] hover:bg-[#1d4fd1] rounded-xl px-4 py-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Module
            </button>
          </div>

          {loading && (
            <p className="text-sm text-gray-400">Loading your modules…</p>
          )}

          {!loading && rows.length === 0 && (
            <p className="text-sm text-gray-400">
              No modules yet. Add modules here, or head to your Profile page to key in past grades.
            </p>
          )}

          {rows.length > 0 && (
            <div className="grid grid-cols-[1fr_7.5rem_5rem_6.5rem_3.5rem_2rem] gap-3 px-1 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Module</span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Sem</span>
              <span className="text-xs font-bold tracking-wider text-gray-400">MCs</span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Grade</span>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">S/U?</span>
              <span />
            </div>
          )}

          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_7.5rem_5rem_6.5rem_3.5rem_2rem] gap-3 items-center">
                <Select
                  options={moduleOptions}
                  styles={selectStyles}
                  isLoading={modulesLoading}
                  placeholder="Select module..."
                  value={
                    row.moduleCode
                      ? moduleOptions.find((option) => option.value === row.moduleCode)
                        || { value: row.moduleCode, label: row.title ? `${row.moduleCode} - ${row.title}` : row.moduleCode }
                      : null
                  }
                  onChange={(selected) => handleModuleSelect(index, selected)}
                />
                <Select
                  options={SEMESTER_OPTIONS}
                  styles={selectStyles}
                  placeholder="Sem"
                  isClearable
                  value={row.semesterTaken ? SEMESTER_OPTIONS.find((o) => o.value === row.semesterTaken) : null}
                  onChange={(selected) => updateRow(index, 'semesterTaken', selected?.value || null)}
                />
                {row.creditUnresolved ? (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.moduleCredit ?? ''}
                    onChange={(e) => updateRow(index, 'moduleCredit', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="MCs"
                    title="Couldn't find this module's credits automatically — enter them manually"
                    className="w-full h-[48px] rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1D63ED]"
                  />
                ) : (
                  <div className="w-full h-[48px] rounded-xl border border-gray-300 bg-gray-100 px-3 text-sm text-center flex items-center justify-center text-gray-600" title="Credits are looked up automatically from the module catalogue">
                    {row.moduleCredit ?? '—'}
                  </div>
                )}
                <Select
                  options={GRADES}
                  styles={selectStyles}
                  placeholder="Grade"
                  isDisabled={!!row.isSu}
                  value={row.grade ? { value: row.grade, label: row.grade } : null}
                  onChange={(selected) => updateRow(index, 'grade', selected?.value || '')}
                />
                <div className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={!!row.isSu}
                    onChange={(e) => updateRow(index, 'isSu', e.target.checked)}
                    title="Mark as S/U (excluded from GPA)"
                    className="h-5 w-5 rounded accent-[#2564F8] cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => removeRow(index)}
                  className="text-gray-400 hover:text-red-500 transition flex justify-center"
                  aria-label="Remove module"
                  title="Remove module"
                >
                  <LuTrash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {saveStatus === 'success' && (
          <div className="text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 transition animate-fade-in">
            Saved successfully to profile!.
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 transition animate-fade-in">
            Something went wrong, please try again.
          </div>
        )}
        {saveStatus === 'validation' && (
          <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 transition animate-fade-in">
            Check that every row has a unique module before saving.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto bg-[#E95420] hover:bg-[#d44513] text-white text-base font-bold py-3.5 px-8 rounded-xl shadow-md transition duration-150 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </main>
    </div>
  );
}