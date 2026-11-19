type SqlToken = {
  kind: "word" | "quoted-identifier" | "symbol";
  value: string;
  depth: number;
};

const ALLOWED_DATA_COMMANDS = new Set(["SELECT", "INSERT", "UPDATE", "DELETE", "MERGE"]);
const UNSAFE_QUERY_MESSAGE =
  "Tenant transaction executor accepts one data statement and rejects transaction/session control.";

function rejectUnsafeQuery(): never {
  throw new Error(UNSAFE_QUERY_MESSAGE);
}

function skipSingleQuotedString(sql: string, start: number, escapeBackslashes: boolean): number {
  let index = start + 1;

  while (index < sql.length) {
    const character = sql.charAt(index);

    if (character === "'" && sql[index + 1] === "'") {
      index += 2;
      continue;
    }

    if (character === "'") return index + 1;

    if (character === "\\") {
      // Ordinary strings are ambiguous if the connection has changed
      // standard_conforming_strings. Require parameters or an explicit E-string.
      if (!escapeBackslashes) rejectUnsafeQuery();
      index += 2;
      continue;
    }

    index += 1;
  }

  return rejectUnsafeQuery();
}

function skipDoubleQuotedIdentifier(
  sql: string,
  start: number,
): { value: string; nextIndex: number } {
  let index = start + 1;
  let value = "";

  while (index < sql.length) {
    const character = sql.charAt(index);

    if (character === '"' && sql[index + 1] === '"') {
      value += '"';
      index += 2;
      continue;
    }

    if (character === '"') return { value, nextIndex: index + 1 };

    value += character;
    index += 1;
  }

  return rejectUnsafeQuery();
}

function skipBlockComment(sql: string, start: number): number {
  let index = start + 2;
  let depth = 1;

  while (index < sql.length && depth > 0) {
    if (sql.startsWith("/*", index)) {
      depth += 1;
      index += 2;
    } else if (sql.startsWith("*/", index)) {
      depth -= 1;
      index += 2;
    } else {
      index += 1;
    }
  }

  if (depth !== 0) return rejectUnsafeQuery();
  return index;
}

function tokenize(sql: string): SqlToken[] {
  if (typeof sql !== "string" || sql.trim().length === 0) return rejectUnsafeQuery();

  const tokens: SqlToken[] = [];
  let index = 0;
  let depth = 0;
  let terminated = false;

  while (index < sql.length) {
    const character = sql.charAt(index);

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (sql.startsWith("--", index)) {
      const newline = sql.indexOf("\n", index + 2);
      index = newline === -1 ? sql.length : newline + 1;
      continue;
    }

    if (sql.startsWith("/*", index)) {
      index = skipBlockComment(sql, index);
      continue;
    }

    if (terminated) return rejectUnsafeQuery();

    if (character === "'") {
      const previous = sql.charAt(index - 1);
      const beforePrevious = sql.charAt(index - 2);
      const escapeString = (previous === "e" || previous === "E")
        && (beforePrevious.length === 0 || !/[A-Za-z0-9_$]/.test(beforePrevious));
      index = skipSingleQuotedString(sql, index, escapeString);
      continue;
    }

    if (character === '"') {
      const identifier = skipDoubleQuotedIdentifier(sql, index);
      tokens.push({
        kind: "quoted-identifier",
        value: identifier.value,
        depth,
      });
      index = identifier.nextIndex;
      continue;
    }

    if (character === "$") {
      const delimiter = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(index))?.[0];
      if (delimiter) {
        const closingIndex = sql.indexOf(delimiter, index + delimiter.length);
        if (closingIndex === -1) return rejectUnsafeQuery();
        index = closingIndex + delimiter.length;
        continue;
      }
    }

    if (character === ";") {
      if (depth !== 0 || terminated) return rejectUnsafeQuery();
      terminated = true;
      index += 1;
      continue;
    }

    if (character === "(") {
      tokens.push({ kind: "symbol", value: "(", depth });
      depth += 1;
      index += 1;
      continue;
    }

    if (character === ")") {
      if (depth === 0) return rejectUnsafeQuery();
      depth -= 1;
      tokens.push({ kind: "symbol", value: ")", depth });
      index += 1;
      continue;
    }

    const word = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(sql.slice(index))?.[0];
    if (word) {
      tokens.push({ kind: "word", value: word.toUpperCase(), depth });
      index += word.length;
      continue;
    }

    tokens.push({ kind: "symbol", value: character, depth });
    index += 1;
  }

  if (depth !== 0 || tokens.length === 0) return rejectUnsafeQuery();
  return tokens;
}

function isWord(token: SqlToken | undefined, value: string): boolean {
  return token?.kind === "word" && token.value === value;
}

function skipParenthesizedGroup(tokens: SqlToken[], start: number): number {
  const opening = tokens[start];
  if (!opening || opening.value !== "(" || opening.depth !== 0) return rejectUnsafeQuery();

  for (let index = start + 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token && token.value === ")" && token.depth === 0) return index + 1;
  }

  return rejectUnsafeQuery();
}

function readMainCommand(tokens: SqlToken[]): string {
  const first = tokens[0];
  if (!first || first.kind !== "word" || first.depth !== 0) return rejectUnsafeQuery();
  if (!isWord(first, "WITH")) return first.value;

  let index = 1;
  if (isWord(tokens[index], "RECURSIVE")) index += 1;

  // Consume the WITH clause structurally so a CTE name such as "update"
  // cannot be mistaken for the statement that actually executes.
  while (true) {
    const cteName = tokens[index];
    if (!cteName || (cteName.kind !== "word" && cteName.kind !== "quoted-identifier")) {
      return rejectUnsafeQuery();
    }
    index += 1;

    const columnList = tokens[index];
    if (columnList?.value === "(" && columnList.depth === 0) {
      index = skipParenthesizedGroup(tokens, index);
    }

    if (!isWord(tokens[index], "AS")) return rejectUnsafeQuery();
    index += 1;

    if (isWord(tokens[index], "NOT")) {
      index += 1;
      if (!isWord(tokens[index], "MATERIALIZED")) return rejectUnsafeQuery();
      index += 1;
    } else if (isWord(tokens[index], "MATERIALIZED")) {
      index += 1;
    }

    const cteBody = tokens[index];
    if (!cteBody || cteBody.value !== "(" || cteBody.depth !== 0) {
      return rejectUnsafeQuery();
    }
    index = skipParenthesizedGroup(tokens, index);

    const separator = tokens[index];
    if (separator?.value === "," && separator.depth === 0) {
      index += 1;
      continue;
    }

    const command = tokens[index];
    if (!command || command.kind !== "word" || command.depth !== 0) return rejectUnsafeQuery();
    return command.value;
  }
}

/**
 * Conservative lexical guard for SQL passed to tenant repository callbacks.
 * It is not a complete PostgreSQL parser: it blocks multiple statements,
 * non-data top-level commands and direct set_config calls, while database
 * functions with indirect side effects still require trusted callers and RLS.
 */
export function assertSafeTenantQuery(sql: string): void {
  const tokens = tokenize(sql);
  const command = readMainCommand(tokens);

  if (!ALLOWED_DATA_COMMANDS.has(command)) return rejectUnsafeQuery();

  // PostgreSQL resolves U&"..." escapes before identifier lookup. This lexer
  // does not decode escaped identifiers, so reject that spelling rather than
  // let an escaped set_config name bypass the direct-call check.
  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (isWord(tokens[index], "U")
      && tokens[index + 1]?.kind === "symbol"
      && tokens[index + 1]?.value === "&"
      && tokens[index + 2]?.kind === "quoted-identifier") {
      return rejectUnsafeQuery();
    }
  }

  if (command === "SELECT" && tokens.some(
    (token) => token.kind === "word" && token.value === "INTO" && token.depth === 0,
  )) {
    return rejectUnsafeQuery();
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    if (!token || !next) return rejectUnsafeQuery();
    const identifier = token.kind === "word" || token.kind === "quoted-identifier";

    if (identifier && token.value.toLowerCase() === "set_config" && next.value === "(") {
      return rejectUnsafeQuery();
    }
  }
}
