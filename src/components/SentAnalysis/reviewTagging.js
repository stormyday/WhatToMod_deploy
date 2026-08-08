const FILTER_KEYWORDS = {
  Workload:   /workload|assignment|hours|project|deadline|week/i,
  Difficulty: /hard|difficult|challeng|tough|content|concept|math/i,
  Tips:       /tip|advice|recommend|suggest|attend|lecture|prepare|warning/i,
  Grade:      /grade|bell curve|a-|b\+|b plus|score|marks|gpa/i,
  "Assessment": /assess|midterm|finals?|exam|quiz|test|practical|pyp|weightage/i,
  Content: /topic|covered|material|content|syllabus/i,
};

export function inferTags(text) {
  const tags = [];

  // Loop through each category key and run its test against the text
  Object.entries(FILTER_KEYWORDS).forEach(([category, regex]) => {
    if (regex.test(text)) {
      tags.push(category);
    }
  });

  if (tags.length === 0) {
    tags.push("General");
  }
  return tags;
}

export function extractRelevantContent(text, activeFilter) {
  if (activeFilter === "All" || activeFilter === "General") return text;
  const blocks = text.split(/(?=\n- |\n\n|\n*)/g);

  const regex = FILTER_KEYWORDS[activeFilter];
  if (!regex) return text;

  const matchingBlocks = blocks.filter(block => regex.test(block));

  return matchingBlocks.length > 0
    ? matchingBlocks.join("\n\n").trim()
    : text;
}
