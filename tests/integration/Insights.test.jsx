import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Insights from '../../src/components/SentAnalysis/Insights';
import * as api from '../../src/utils/api';

afterEach(cleanup);

vi.mock('../../src/utils/api', () => ({
  fetchModuleList: vi.fn(),
  fetchModule: vi.fn(),
}));

const MODULE_LIST = [
  { moduleCode: 'CS1010', title: 'Programming Methodology', semesters: [1, 2] },
];

function buildModuleResponse(overrides = {}) {
  return {
    module: {
      moduleCode: 'CS1010',
      title: 'Programming Methodology',
      description: 'An introduction to programming.',
      moduleCredit: '4',
      department: 'Computer Science',
      faculty: 'Computing',
      semesterData: [{ semester: 1, timetable: [] }],
    },
    reviews: [
      { id: 'r1', moduleCode: 'CS1010', text: 'Great module, learnt a lot.', semester: 'Semester 1', scrapedAt: '2026-01-01' },
    ],
    sentiment: {
      moduleCode: 'CS1010',
      reviewCount: 1,
      workload: { label: 'Workload', level: 'Moderate', score: 0.5, descriptor: 'Manageable' },
      difficulty: { label: 'Difficulty', level: 'Easy', score: 0.3, descriptor: 'Beginner friendly' },
      expectedGrade: { label: 'Expected grade', level: 'A', score: 0.8, descriptor: 'Most get As' },
      overallVibe: { label: 'Overall vibe', level: 'Positive', score: 0.9, descriptor: 'Well liked' },
      tips: ['Attend every lecture'],
      generatedAt: '2026-01-01',
    },
    moduleAspects: [{ aspect: 'lectures', sentiment: 'positive', note: 'Engaging lectures' }],
    keyInfo: null,
    suggestions: [{ category: 'other', suggestion: 'More practice questions' }],
    professors: [{ name: 'Dr Tan', semester: 'Semester 1', mentionCount: 3 }],
    ...overrides,
  };
}

function renderInsights(initialPath = '/insights') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/insights" element={<Insights />} />
        <Route path="/insights/:moduleCode" element={<Insights />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchModuleList.mockResolvedValue(MODULE_LIST);
  });

  it('shows a prompt to search before anything has been loaded', async () => {
    renderInsights();
    await waitFor(() => expect(api.fetchModuleList).toHaveBeenCalled());
    expect(screen.getByText('Search for any module')).toBeInTheDocument();
  });

  it('searching and selecting a suggestion loads and displays the module', async () => {
    api.fetchModule.mockResolvedValue(buildModuleResponse());
    renderInsights();
    await waitFor(() => expect(api.fetchModuleList).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText('Search module code or title...'), {
      target: { value: 'cs1' },
    });
    await waitFor(() => expect(screen.getByText('Programming Methodology')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Programming Methodology'));

    await waitFor(() => expect(api.fetchModule).toHaveBeenCalledWith('CS1010'));
    expect(await screen.findByText('4 MCs')).toBeInTheDocument();
    expect(screen.getByText('Summary of Reviews')).toBeInTheDocument();
    expect(screen.getByText(/Student reviews/)).toBeInTheDocument();
  });

  it('navigating directly to /insights/:moduleCode auto-loads that module', async () => {
    api.fetchModule.mockResolvedValue(buildModuleResponse());
    renderInsights('/insights/CS1010');

    await waitFor(() => expect(api.fetchModule).toHaveBeenCalledWith('CS1010'));
    expect(await screen.findByText('Programming Methodology', { selector: '.module-title' })).toBeInTheDocument();
  });

  it('shows an error banner when the module fails to load', async () => {
    api.fetchModule.mockRejectedValue(new Error('Module BADCODE not found'));
    renderInsights('/insights/BADCODE');

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Module BADCODE not found')).toBeInTheDocument();
  });

  it('shows a loading skeleton while the module is being fetched', async () => {
    let resolveFetch;
    api.fetchModule.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    renderInsights('/insights/CS1010');
    await waitFor(() => expect(document.querySelector('.skeleton-wrap')).not.toBeNull());

    resolveFetch(buildModuleResponse());
    await waitFor(() => expect(document.querySelector('.skeleton-wrap')).toBeNull());
    expect(screen.getByText('Programming Methodology', { selector: '.module-title' })).toBeInTheDocument();
  });

  it('switches between the Overview and LLM Curated Insights tabs', async () => {
    api.fetchModule.mockResolvedValue(buildModuleResponse());
    renderInsights('/insights/CS1010');
    await waitFor(() => expect(screen.getByText('Programming Methodology', { selector: '.module-title' })).toBeInTheDocument());

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Summary of Reviews')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'LLM Curated Insights' }));

    expect(screen.getByRole('tab', { name: 'LLM Curated Insights' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Summary of Reviews')).not.toBeInTheDocument();
    expect(screen.getByText('What students say:')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Summary of Reviews')).toBeInTheDocument();
    expect(screen.queryByText('What students say:')).not.toBeInTheDocument();
  });
});
