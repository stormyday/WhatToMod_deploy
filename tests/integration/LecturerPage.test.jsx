import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LecturerPage from '../../src/components/SentAnalysis/LecturerPage';
import * as api from '../../src/utils/api';

// This project's vitest config doesn't set `globals: true`, so React Testing
// Library's automatic afterEach(cleanup) never registers — do it explicitly
// so each test in this file starts from an empty DOM.
afterEach(cleanup);

// LecturerPage.jsx uses the real useProfessorProfile hook; mocking api.ts
// (fetchProfessorProfile) keeps this an integration test of the page + hook
// + child components working together, without a real network/Supabase call.
vi.mock('../../src/utils/api', () => ({
  fetchProfessorProfile: vi.fn(),
}));

function buildProfile(overrides = {}) {
  return {
    name: 'Dr Tan',
    modules: [{ moduleCode: 'CS1010', semesters: ['Semester 1'], mentionCount: 3 }],
    relatedModules: [],
    reviewMentions: [
      { id: 'r1', moduleCode: 'CS1010', text: 'Dr Tan explains concepts very clearly.', semester: 'Semester 1', scrapedAt: '2026-01-01' },
    ],
    ...overrides,
  };
}

function renderLecturerPage(initialPath = '/professor/Dr%20Tan', state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialPath, state }]}>
      <Routes>
        <Route path="/professor/:name" element={<LecturerPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LecturerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading skeleton while the profile is being fetched', async () => {
    let resolveFetch;
    api.fetchProfessorProfile.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    renderLecturerPage();
    await waitFor(() => expect(document.querySelector('.skeleton-wrap')).not.toBeNull());

    resolveFetch(buildProfile());
    await waitFor(() => expect(document.querySelector('.skeleton-wrap')).toBeNull());
  });

  it('decodes the name from the URL and requests that professor\'s profile', async () => {
    api.fetchProfessorProfile.mockResolvedValue(buildProfile());
    renderLecturerPage('/professor/Dr%20Tan');

    await waitFor(() => expect(api.fetchProfessorProfile).toHaveBeenCalledWith('Dr Tan', undefined));
    expect(await screen.findByRole('heading', { name: 'Dr Tan' })).toBeInTheDocument();
  });

  it('shows the modules taught, with each one linking back to its insights page', async () => {
    api.fetchProfessorProfile.mockResolvedValue(buildProfile());
    renderLecturerPage();

    expect(await screen.findByRole('button', { name: 'CS1010' })).toBeInTheDocument();
    expect(screen.getByText('Mentioned in reviews')).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '.reviews-count' })).toBeInTheDocument();
  });

  it('shows the empty-state notes when there are no modules or review mentions', async () => {
    api.fetchProfessorProfile.mockResolvedValue(buildProfile({ modules: [], reviewMentions: [] }));
    renderLecturerPage();

    expect(await screen.findByText('No reviews mention this name yet.')).toBeInTheDocument();
    expect(screen.getByText('No reviews mention "Dr Tan" yet.')).toBeInTheDocument();
  });

  it('shows the "possibly the same lecturer" section only when there are related names', async () => {
    api.fetchProfessorProfile.mockResolvedValue(buildProfile());
    renderLecturerPage();
    await waitFor(() => expect(api.fetchProfessorProfile).toHaveBeenCalled());
    expect(screen.queryByText('This prof may also be teaching:')).not.toBeInTheDocument();

    cleanup();
    api.fetchProfessorProfile.mockResolvedValue(buildProfile({
      relatedModules: [
        { name: 'Dr T. Tan', moduleCode: 'CS2030', semesters: ['Semester 2'], mentionCount: 2 },
      ],
    }));
    renderLecturerPage();

    expect(await screen.findByText('This prof may also be teaching:')).toBeInTheDocument();
    expect(screen.getByText('Dr T. Tan')).toBeInTheDocument();
  });

  it('expands and collapses a long review mention', async () => {
    const longText = 'Dr Tan '.repeat(60); // > 280 chars
    api.fetchProfessorProfile.mockResolvedValue(buildProfile({
      reviewMentions: [{ id: 'r1', moduleCode: 'CS1010', text: longText, semester: 'Semester 1', scrapedAt: '2026-01-01' }],
    }));
    renderLecturerPage();

    const showMore = await screen.findByText('Show more');
    fireEvent.click(showMore);
    expect(screen.getByText('Show less')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Show less'));
    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('shows an error banner when the profile fails to load', async () => {
    api.fetchProfessorProfile.mockRejectedValue(new Error('Something went wrong'));
    renderLecturerPage();

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('navigates back to the originating module when arriving from a module page', async () => {
    api.fetchProfessorProfile.mockResolvedValue(buildProfile());
    renderLecturerPage('/professor/Dr%20Tan', { fromModuleCode: 'CS1010' });

    await waitFor(() => expect(api.fetchProfessorProfile).toHaveBeenCalledWith('Dr Tan', 'CS1010'));
    expect(screen.getByText('Back')).toBeInTheDocument();
  });
});
