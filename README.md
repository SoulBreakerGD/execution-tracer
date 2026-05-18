# Execution Tracer

A custom programming language interpreter with step-by-step execution visualization, built from scratch in TypeScript and React.

> 🚧 **In progress** — Tokenizer is in progress. Parser, Interpreter, and Visualizer UI coming next.

---

## What is this?

Execution Tracer is an interpreter for a custom language, built without any parser/compiler libraries. The goal is to understand how programming languages work under the hood — from raw source code to visual execution.

When complete, you'll be able to write code in Execution Tracer's language and watch it execute step by step: seeing variable states, call stacks, and scope changes in real time.

---

## How it works

Source code goes through three stages:

```
Source code (string)
      ↓
  Tokenizer       → breaks raw text into typed tokens with position info
      ↓
  Parser          → builds an Abstract Syntax Tree (AST) from tokens  [upcoming]
      ↓
  Interpreter     → walks the AST, executes the program step by step  [upcoming]
      ↓
  Visualizer UI   → React interface to inspect each execution step     [upcoming]
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

- **TypeScript** — strict typing throughout, discriminated union types for the token system
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

### 🔲 Parser
### 🔲 Interpreter  
### 🔲 Visualizer UI

---

## Design decisions

**Discriminated union types for tokens** — instead of a single `Token` interface with an optional `value` field, each token variant is its own interface (`KeywordToken`, `IdentifierToken`, `NumberToken`, ...) unified under a `Token` union type. TypeScript narrows the type correctly at every check point.

**String literal types over enums** — token types are the actual characters and keywords (`'+'`, `'if'`, `'identifier'`) rather than enum members (`PLUS`, `IF`, `IDENTIFIER`). This removes the need for a mapping layer and makes the code self-documenting.

**Incrementer class** — position tracking (line, column, index) is extracted into its own class with a controlled interface: `advance()`, `newline()`, and `snapshot()`. `snapshot()` returns a shallow copy to prevent position references from being mutated after the fact.

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

This project is a deliberate exercise in building something from first principles — understanding what a framework or runtime actually does before relying on one. Every part of the pipeline (tokenizing, parsing, evaluating) is written by hand to make the internals visible and understandable.
