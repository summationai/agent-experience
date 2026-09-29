/** A small unified diff (git style, three lines of context) for the files init writes. */

type Op = { kind: " " | "-" | "+"; line: string };

function lines(text: string): string[] {
  if (text === "") return [];
  const out = text.split("\n");
  if (out[out.length - 1] === "") out.pop();
  return out;
}

/** Line operations from an LCS table; fine for source files of a few thousand lines. */
function ops(a: string[], b: string[]): Op[] {
  // Trim the common prefix and suffix first, so the table covers only the changed middle.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  const table: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i]![j] =
        midA[i] === midB[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const out: Op[] = a.slice(0, start).map((line) => ({ kind: " ", line }));
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && midA[i] === midB[j]) {
      out.push({ kind: " ", line: midA[i]! });
      i++;
      j++;
    } else if (i < n && (j === m || table[i + 1]![j]! >= table[i]![j + 1]!)) {
      out.push({ kind: "-", line: midA[i]! });
      i++;
    } else {
      out.push({ kind: "+", line: midB[j]! });
      j++;
    }
  }
  for (const line of a.slice(endA)) out.push({ kind: " ", line });
  return out;
}

/**
 * The unified diff from `before` to `after` for `path` (relative, forward slashes). `before`
 * undefined is a new file. Returns "" when nothing changed.
 */
export function unifiedDiff(path: string, before: string | undefined, after: string): string {
  if (before === after) return "";
  const a = lines(before ?? "");
  const b = lines(after);
  const all = ops(a, b);
  const header = [
    `diff --git a/${path} b/${path}`,
    ...(before === undefined ? ["new file mode 100644", "--- /dev/null"] : [`--- a/${path}`]),
    `+++ b/${path}`,
  ];
  const context = 3;
  const hunks: string[] = [];
  let k = 0;
  while (k < all.length) {
    if (all[k]!.kind === " ") {
      k++;
      continue;
    }
    // A hunk runs from `context` lines before this change to `context` lines after the last
    // change that is within 2 * context of the previous one.
    let begin = Math.max(0, k - context);
    let end = k;
    for (;;) {
      while (end < all.length && all[end]!.kind !== " ") end++;
      let next = end;
      while (next < all.length && all[next]!.kind === " ") next++;
      if (next < all.length && next - end <= 2 * context) end = next;
      else break;
    }
    const stop = Math.min(all.length, end + context);
    let oldStart = 1;
    let newStart = 1;
    for (let x = 0; x < begin; x++) {
      if (all[x]!.kind !== "+") oldStart++;
      if (all[x]!.kind !== "-") newStart++;
    }
    const body = all.slice(begin, stop);
    const oldCount = body.filter((o) => o.kind !== "+").length;
    const newCount = body.filter((o) => o.kind !== "-").length;
    hunks.push(
      `@@ -${oldCount === 0 ? oldStart - 1 : oldStart},${oldCount} +${newCount === 0 ? newStart - 1 : newStart},${newCount} @@`,
      ...body.map((o) => `${o.kind}${o.line}`),
    );
    begin = stop;
    k = stop;
  }
  return [...header, ...hunks].join("\n") + "\n";
}
