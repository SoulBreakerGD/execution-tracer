# Context — Trạng thái thực thi

## Vấn đề

Interpreter execute **từng bước nhỏ** để Visualizer có thể pause sau mỗi bước. Một `BinaryExpression` không thể tính xong trong một bước vì `left` và `right` là các expressions khác — phải push vào `executionStack` và tính riêng từng cái.

Context cung cấp **bookmark** là các state cho các AST nodes để có thể traverse AST

---

## Context = AST node + trạng thái thực thi

```
AST node  →  cấu trúc ngữ pháp, không thay đổi
Context   →  tiến độ thực thi, thay đổi mỗi bước
```

Mỗi lần `execution()` được gọi, nó nhìn vào `phase` để biết làm gì tiếp theo.

---

## executionStack & Accumulator

```typescript
executionStack: Context[]   // engine của Interpreter — thay thế JS call stack
```

```typescript
interface Accumulator {
    value: Pointer; // kết quả của expression/statement vừa xong
    isReturn: boolean; // true khi đang unwind stack do return
}
```

Luồng cơ bản: child xong → ghi vào `accumulator.value` → pop → parent đọc `accumulator.value`.

`isReturn: true` → mọi context trên đường về đều bị pop cho đến khi gặp `CallContext`.

---

## Các loại Context và phases

### BlockContext

Không có phase — dùng `programCounter` thay thế.

- Mỗi bước: push `statements[programCounter]` vào `executionStack`, `programCounter++`
- Khi `programCounter >= statements.length` → pop

---

### PrimitiveContext

`init → done`

- `init`: tạo RuntimeValue trên Heap, ghi Pointer vào `accumulator.value`
- `done`: pop

---

### ParenthesizedExpressionContext

`init → done`

- `init`: push inner expression trong ( ) vào `executionStack`
- `done`: `accumulator.value` đã có kết quả → pop

---

### BinaryExpressionContext

`init → lhscomputed → rhscomputed`

- `init`: push `left` expression vào `executionStack`
- `lhscomputed`: lưu `accumulator.value` vào `context.left`, push `right` expression
- `rhscomputed`: có đủ `left` + `accumulator.value` (right) → apply operator → ghi kết quả vào `accumulator.value` → pop

`left?: Pointer` — lưu tạm vì `accumulator.value` bị ghi đè khi tính `right`.

---

### UnaryExpressionContext

`init → argcomputed`

- `init`: push `argument` expression vào `executionStack`
- `argcomputed`: apply operator lên `accumulator.value` → ghi kết quả → pop

---

### PropAccessContext

`init → targetcomputed`

- `init`: push `target` expression vào `executionStack`
- `targetcomputed`: lookup `property` trên `ObjectValue` → ghi Pointer vào `accumulator.value` → pop

---

### ElementAccessContext

`init → targetcomputed → indexcomputed`

- `init`: push `target` vào `executionStack`
- `targetcomputed`: lưu `accumulator.value` vào `context.target`, push `index` expression
- `indexcomputed`: dùng `target` + `accumulator.value` (index) → lookup element → ghi vào `accumulator.value` → pop

`target?: Pointer` — lưu tạm vì `accumulator.value` bị ghi đè khi tính `index`.

---

### CallContext

`init → targetcomputed → argcomputed → callready → done`

- `init`: push `target` expression vào `executionStack`
- `targetcomputed`: lưu function vào `context.target`, bắt đầu tính args
- `argcomputed`: mỗi argument xong → push Pointer vào `context.args`, tính argument tiếp theo
- `callready`: tất cả args xong → setup `LexicalEnvironment` mới, push body `Block`
- `done`: body xong → `accumulator.value` là return value → pop

---

### ArrayLiteralContext

`init → elementscomputed → done`

- `init`: push element đầu tiên vào `executionStack`
- `elementscomputed`: mỗi element xong → push Pointer vào `context.elements[]`, push element tiếp theo. Khi hết → tạo `ArrayValue` trên Heap
- `done`: ghi Pointer vào `accumulator.value` → pop

---

### ObjectLiteralContext

`init → keycomputed → valuecomputed → done`

- `init`: xác định key (string), lưu vào `context.key`
- `keycomputed`: push value expression vào `executionStack`
- `valuecomputed`: push `[key, Pointer]` vào `context.pairs[]`, xử lý pair tiếp theo. Khi hết → tạo `ObjectValue` trên Heap
- `done`: ghi Pointer vào `accumulator.value` → pop

---

### IfStatementContext

`init → condcomputed → done`

- `init`: push `condition` vào `executionStack`
- `condcomputed`: `isTruthy`? push `body` Block : check `elseIf[0]` hoặc `else`
- `done`: pop

---

### ElseIfContext

`init → condcomputed → done`

Giống `IfStatementContext` nhưng dùng `context.index` để biết đang xử lý `elseIf[index]`.

- `init`: push `condition` của `elseIf[index]` vào `executionStack`
- `condcomputed`: `isTruthy`? push body : check `elseIf[index+1]` hoặc `else` branch
- `done`: pop

---

### WhileLoopContext

`init → condcomputed`

- `init`: push `condition` vào `executionStack`
- `condcomputed`: `isTruthy`? push `body` Block → reset phase về `init`. Không truthy → pop

Không có phase `done` — khi không truthy thì pop luôn.

---

### FunctionDeclarationContext

Không có phase — một bước là xong.

- Tạo `FunctionValue` (lưu AST node + `parentEnv` cho closure), set vào `LexicalEnvironment` → pop

---

### ReturnStatementContext

`init → done`

- `init`: có `expression` → push vào `executionStack`. Không có → set `accumulator.value = null`, set `accumulator.isReturn = true` → pop
- `done`: set `accumulator.isReturn = true` → pop

---

### IdentifierAssignmentContext

`init → rhscomputed`

- `init`: push `right` expression vào `executionStack`
- `rhscomputed`: lookup tên biến trong `LexicalEnvironment` → update Pointer → pop

---

### PropAccessAssignmentContext

`init → rhscomputed → targetcomputed`

- `init`: push `right` vào `executionStack`
- `rhscomputed`: lưu `accumulator.value` vào `context.right`, push `target` expression
- `targetcomputed`: lookup property trên `ObjectValue` → update Pointer → pop

`right?: Pointer` — lưu tạm vì `accumulator.value` bị ghi đè khi tính `target`.

---

### ElementAccessAssignmentContext

`init → rhscomputed → targetcomputed → indexcomputed`

- `init`: push `right` vào `executionStack`
- `rhscomputed`: lưu vào `context.right`, push `target` expression
- `targetcomputed`: lưu vào `context.target`, push `index` expression
- `indexcomputed`: dùng `target` + index → update element Pointer → pop

---

### ExpressionStatementContext

`init → done`

- `init`: push inner expression vào `executionStack`
- `done`: kết quả bị bỏ qua (statement không return value) → pop
