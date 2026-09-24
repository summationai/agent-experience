/** Parser for spec/VOCABULARY.md tables. Mirrors scripts/vocabulary-parse.mjs; the generator test keeps them aligned. */
export interface VocabEntry {
  category: string;
  key: string;
  name: string;
  where: string;
  meaning: string;
}

export function parseVocabulary(markdown: string): VocabEntry[] {
  const entries: VocabEntry[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 5) continue;
    const [category, key, rawName, where, meaning] = cells as [
      string,
      string,
      string,
      string,
      string,
    ];
    if (category === "Category" || /^-+$/.test(category)) continue;
    const m = /^`([^`]+)`$/.exec(rawName);
    if (!m)
      throw new Error(
        `Vocabulary row for key "${key}" has a name that is not in backticks: ${rawName}`,
      );
    entries.push({ category, key, name: m[1]!, where, meaning });
  }
  return entries;
}
