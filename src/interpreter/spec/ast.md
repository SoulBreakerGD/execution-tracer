# AST — Abstract Syntax Tree

## Tại sao cần AST?

Tokenizer trả về một **dãy phẳng** — không thể hiện được thứ tự ưu tiên toán tử:

```
[LET] [x] [=] [1] [+] [2] [*] [3] [;]
```

AST biểu diễn lại dưới dạng **cây** — cấu trúc phản ánh đúng ngữ pháp và độ ưu tiên:

```
        [=]
       /   \
    [x]    [+]
           / \
         [1] [*]
             / \
           [2] [3]
```

Interpreter walk từ dưới lên: tính `2 * 3 = 6` → `1 + 6 = 7` → gán `x = 7`.
Thứ tự ưu tiên được encode vào cấu trúc cây — không cần xử lý thêm.

---

## Các loại node

**Literals** — giá trị đơn, không có child node:

- `NumberLiteral(42)`, `StringLiteral("hello")`, `BooleanLiteral(true)`, `NullLiteral`
- `Identifier('x')` — tên biến hoặc hàm

**Expressions** — có child là expressions khác, trả về giá trị khi tính toán:

- `BinaryExpression(left, operator, right)` — `x + 1`, `a == b`
- `UnaryExpression(operator, argument)` — `!true`, `-x`
- `Call(target, arguments[])` — `add(1, 2)`, `print(x)`
- `PropAccess(target, property)` — `obj.name`
- `ElementAccess(target, index)` — `arr[0]`

**Statements** — câu lệnh hoàn chỉnh, không trả về giá trị:

- `AssignmentStatement(left, right)` — `x = 42`
- `ReturnStatement(expression?)` — `return x + 1`
- `IfStatement(condition, body, elseIf[], else?)` — `if / else if / else`
- `WhileLoop(condition, body)` — `while (x > 0) { ... }`
- `FunctionDeclaration(name, params[], body)` — `fn add(a, b) { ... }`
- `ExpressionStatement(expression)` — expression đứng một mình: `print(x);`

**Block** — phần thân `{ ... }` của `if`, `while`, `fn` — chứa danh sách statements.

---

## Quy tắc phân biệt Expression và Statement

> Nếu có thể viết `let x = <thứ này>` — đó là **Expression**.
> Nếu không thể — đó là **Statement**.
