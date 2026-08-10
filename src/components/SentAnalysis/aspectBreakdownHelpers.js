export function groupProfessorsBySemester(professors = []) {
  return professors.reduce((acc, p) => {
    const sem = p.semester && p.semester !== "Unclear" ? p.semester : "Semester unclear";
    (acc[sem] ??= []).push(p);
    return acc;
  }, {});
}
