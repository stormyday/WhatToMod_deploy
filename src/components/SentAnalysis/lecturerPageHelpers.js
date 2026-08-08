export function semesterLabel(semesters) {
  const known = semesters.filter((s) => s !== "Unclear");
  return known.length > 0 ? known.join(", ") : "Semester unclear";
}

export function groupRelatedModulesByName(relatedModules = []) {
  return relatedModules.reduce((acc, m) => {
    (acc[m.name] ??= []).push(m);
    return acc;
  }, {});
}
