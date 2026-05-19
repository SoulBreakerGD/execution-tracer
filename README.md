# Execution Tracer

A custom programming language interpreter with step-by-step execution visualization, built from scratch in TypeScript and React.

> 🚧 **In progress** — Tokenizer and TokenManager complete. Parser and beyond coming next.

---

## How it works

```
Source code (string)
      ↓
  Tokenizer       → breaks raw text into typed tokens with position info
      ↓
  TokenManager    → cursor interface for Parser to consume tokens safely
      ↓
  Parser          → builds an Abstract Syntax Tree (AST) from tokens       [upcoming]
      ↓
  Interpreter     → walks the AST, executes the program step by step       [upcoming]
      ↓
  Visualizer UI   → React interface to inspect each execution step          [upcoming]
```

---

## Language features (planned)

```
fn fib(n) {
  if (n == 0) {
    return 0;
  }
  if (n == 1) {
    return 1;
  }

  left = fib(n - 1);
  right = fib(n - 2);
  return left + right;
}

print(fib(3));
```

```
fn floodfill(M, sr, sc, fill) {
  if (M[sr][sc] == fill) {
    return;
  }

  oldFill = M[sr][sc];

  fn dfs(r, c) {
    if (r < 0 || r >= len(M) || c < 0 || c >= len(M[0])) {
      return;
    }
    if (M[r][c] != oldFill) {
      return;
    }

    M[r][c] = fill;
    dfs(r - 1, c);
    dfs(r + 1, c);
    dfs(r, c - 1);
    dfs(r, c + 1);
  }

  dfs(sr, sc);
}

M = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1]
];

floodfill(M, 2, 2, 25);

print(M);
```

Supports: variables, functions, closures, recursion, conditionals, loops, arrays, null.

---

## Tech stack

- **TypeScript** — strict typing throughout; discriminated union types for the token system
- **React** — step-by-step execution visualizer (upcoming)

No parser generator libraries (e.g. ANTLR, PEG.js). Everything is hand-written.

---

## Current progress

### ✅ Tokenizer

Converts raw source code into a typed token array. Each token carries:

- `type` — what kind of token it is (`'if'`, `'identifier'`, `'+'`, `'number'`, ...)
- `value` — the runtime value for identifiers, strings, and numbers
- `location` — `{ start, end }` with `line`, `column`, `index` for each position

Handles: keywords, identifiers, number literals (including decimals), string literals, one/two-character symbols, whitespace, newlines, and unexpected character errors.

### ✅ TokenManager

A cursor interface that Parser uses to consume the token array safely. Exposes two operations:

- **`peek()`** — returns the current token without advancing. Parser calls this to decide which grammar rule to apply next.
- **`eat(expectedType)`** — validates that the current token matches the expected type, advances the cursor, and returns the token. Throws a descriptive syntax error on mismatch (e.g. `Expected '(' but got 'identifier'`).

`eat()` accepts either a single type or an array of types — useful when the Parser can accept multiple valid tokens at a given position. Unlike some implementations that make the expected type optional, requiring it explicitly here prevents silent failures and makes grammar expectations visible at every call site.

### 🔲 AST node types

### 🔲 Parser

### 🔲 Interpreter

### 🔲 Visualizer UI

---

## Design decisions

**Discriminated union types for tokens** — each token variant is its own interface (`KeywordToken`, `IdentifierToken`, `NumberToken`, ...) unified under a `Token` union type. TypeScript narrows correctly at every check, so accessing `.value` on a `NumberToken` is type-safe without casting.

**String literal types over enums** — token types are the actual characters and keywords (`'+'`, `'if'`, `'identifier'`) rather than enum members (`PLUS`, `IF`, `IDENTIFIER`). This removes a mapping layer and makes the token system self-documenting.

**Incrementer class** — position tracking (line, column, index) is extracted into its own class. `snapshot()` returns a shallow copy of the current position so that token locations are not mutated as the cursor advances.

**Required expected type in `eat()`** — making the expected type non-optional means every call site explicitly declares what token it expects. This makes grammar rules readable in code and produces clear error messages when source code doesn't match.

---

## Getting started

```bash
git clone https://github.com/SoulBreakerGD/execution-tracer
cd execution-tracer
npm install
npm run dev
```

---

## Motivation

This project is an exercise in building from first principles — understanding what a language runtime actually does before relying on one. Every stage of the pipeline is written by hand to make the internals visible and understandable.
