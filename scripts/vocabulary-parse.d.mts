export interface VocabEntry {
  category: string;
  key: string;
  name: string;
  where: string;
  meaning: string;
}
export function parseVocabulary(markdown: string): VocabEntry[];
export function readVocabulary(path: string): VocabEntry[];
export function renderVocabularyTs(entries: VocabEntry[]): string;
