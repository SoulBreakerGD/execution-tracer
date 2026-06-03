# Execution Tracer

A custom programming language interpreter with step-by-step execution visualization, built from scratch in TypeScript and React.

> 🚧 **In progress** — Tokenizer, Parser, and Interpreter core complete. Visualizer UI coming next.

---

## How it works

```
Source code (string)
      ↓
  Tokenizer       → breaks raw text into typed tokens with position info
      ↓
  TokenManager    → cursor interface for Parser to consume tokens safely
      ↓
  Parser          → builds an Abstract Syntax Tree (AST) from tokens
      ↓
  Interpreter     → walks the AST step by step via an explicit execution stack
      ↓
  Visualizer UI   → React interface to inspect each execution step             [upcoming]
```

---

## Language features

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

Supports: variables, functions, closures, recursion, conditionals, loops, arrays, objects, null.

Built-in functions: `print`, `len`, `push`, `pop`, `del`.

---

## Tech stack

- **TypeScript** — strict typing throughout; discriminated union types for both the token system and AST nodes
- **React** — step-by-step execution visualizer (upcoming)

No parser generator libraries (e.g. ANTLR, PEG.js). Everything is hand-written.

---

## Current progress

### ✅ Tokenizer

Converts raw source code into a typed token array. Each token carries:

- `type` — what kind of token it is (`'if'`, `'identifier'`, `'+'`, `'number'`, ...)
- `value` — the runtime value for identifiers, strings, and numbers
- `location` — `{ start, end }` with `line`, `column`, `index` for each position

### ✅ TokenManager

A cursor interface for Parser to consume the token array safely:

- **`peek()`** — returns the current token without advancing
- **`eat(expectedType)`** — validates type, advances, returns the token. Required expected type (non-optional) makes every call site explicitly declare what it expects, producing clear syntax errors on mismatch.

### ✅ Parser

Full recursive descent parser with operator precedence chain:

```
expression → or → and → equality → relational → additive → multiplicative → unary → access/call → atom
```

Handles: `if/else if/else`, `while`, `fn`, assignment, all expression types, object/array literals, closures.

### ✅ Interpreter

Step-by-step execution engine using an **explicit execution stack** instead of JS recursion — enabling pause/resume at any point for the visualizer.

Key components:

- **Heap** — central storage for all runtime values; code passes `Pointer` strings, not values directly
- **LexicalEnvironment** — scope chain with `get()` (traverse up to find), `set()` (declare in local scope), and `update()` (traverse up to find and mutate the owning scope — correct closure assignment behavior)
- **CallStack** — tracks execution frames for UI display
- **Context system** — each AST node type has a corresponding Context with a `phase` field that bookmarks progress across steps (e.g. `BinaryExpressionContext`: `init → lhscomputed → rhscomputed`)

### 🔲 Visualizer UI

---

## Design decisions

**Discriminated union types for tokens and AST nodes** — each variant is its own interface unified under a union type. TypeScript narrows correctly at every check point without casting.

**String literal types over enums** — token types are the actual characters (`'+'`, `'if'`) rather than enum members (`PLUS`, `IF`). Removes a mapping layer and makes the system self-documenting.

**Incrementer class** — position tracking extracted into its own class. `snapshot()` returns a shallow copy so token locations are not mutated as the cursor advances.

**Required expected type in `eat()`** — non-optional makes grammar rules readable at every call site and produces clear error messages.

**Explicit execution stack over JS recursion** — `executionStack: Context[]` replaces the JS call stack, making it possible to pause execution at any step and resume later. Impossible with standard recursive tree traversal.

**`update()` vs `set()` for variable assignment** — `update()` traverses the scope chain upward to find and mutate the scope that owns the variable (correct closure behavior). `set()` always writes to the current local scope (used for parameter binding and function declarations). Without this distinction, assignments inside nested functions would silently shadow outer variables instead of updating them.

**Short-circuit evaluation** — `&&` and `||` skip evaluating the right side when the result is already determined by the left side, matching standard language semantics.

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
