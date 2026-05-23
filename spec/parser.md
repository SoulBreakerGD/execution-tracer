## Parser là gì?

Parser nhận vào **array tokens** từ Tokenizer và tạo ra **AST (Abstract Syntax Tree)** — một cây biểu diễn cấu trúc ngữ pháp của chương trình.

```
Token[]  →  Parser  →  AST (Block node)
```

Nếu Tokenizer trả lời câu hỏi _"chương trình gồm những đơn vị gì"_, thì Parser trả lời _"những đơn vị đó kết hợp với nhau theo cấu trúc nào"_.

---

## Kiến trúc tổng quan

Parser được tổ chức theo **Recursive Descent** — mỗi loại cấu trúc ngữ pháp có một method riêng, và chúng gọi lẫn nhau theo đệ quy.

```
parse()
  └── parseBlock()
        └── parseStatement()  ← gọi 1 trong 5 branches
              ├── parseIfStatement()
              │     ├── parseExpression()  ← condition
              │     └── parseBlock()       ← đệ quy: body cũng là Block
              ├── parseWhileLoop()
              │     ├── parseExpression()
              │     └── parseBlock()       ← đệ quy
              ├── parseFunctionDeclaration()
              │     └── parseBlock()       ← đệ quy
              ├── parseReturnStatement()
              │     └── parseExpression()
              └── parseAssignmentOrExpressionStatement()
                    └── parseExpression()
```

---

## Lookahead — quyết định không phá hủy

Trước khi gọi bất kỳ method nào, Parser **nhìn trước** token hiện tại bằng `peek()` mà không tiêu thụ nó. Đây là nguyên tắc cốt lõi:

```
peek()   →  chỉ nhìn, không di chuyển
eat()    →  tiêu thụ và advance
```

Ví dụ `parseStatement()`:

```typescript
parseStatement(): Statement {
    const token = this.tokenManager.peek()   // nhìn, không eat()

    if (isIfStatementLookahead(token))    return this.parseIfStatement()
    if (isWhileLoopLookahead(token))      return this.parseWhileLoop()
    if (isFunctionDeclarationLookahead(token)) return this.parseFunctionDeclaration()
    if (isReturnStatementLookahead(token)) return this.parseReturnStatement()
    if (isExpressionLookahead(token))     return this.parseAssignmentOrExpressionStatement()

    throw new Error(`Unexpected token: ${token.type}`)
}
```

`parseStatement()` **chỉ quyết định và delegate** — không tự eat bất cứ token nào. Để method con tự xử lý.

---

## Operator Precedence — tầng phân tầng

Thay vì một method `parseExpression()` duy nhất, Parser có **một tầng cho mỗi nhóm độ ưu tiên**:

```
parseExpression()
  └── parseOrExpression()              ← ||
        └── parseAndExpression()       ← &&
              └── parseEqualityExpression()      ← ==  !=
                    └── parseRelationalExpression()    ← <  >  <=  >=
                          └── parseAdditiveExpression()      ← +  -
                                └── parseMultiplicativeExpression()  ← *  /  %
                                      └── parseUnaryExpression()     ← !  -  +
                                            └── parseAccessOrCallExpression()  ← .  []  ()
                                                  └── parseAtom()    ← literal, identifier
```

**Tại sao phân tầng?**

Mỗi tầng gọi tầng dưới trước → tầng dưới có độ ưu tiên cao hơn → được tính trước.

Ví dụ `1 + 2 * 3`:

```
parseAdditiveExpression()
  left = parseMultiplicativeExpression()
           left = parseUnaryExpression() → parseAtom() → NumberLiteral(1)
           peek() = '+' → không phải '*', '/', '%' → return NumberLiteral(1)
         → left = NumberLiteral(1)
  peek() = '+' → eat('+')
  right = parseMultiplicativeExpression()
            left = parseUnaryExpression() → parseAtom() → NumberLiteral(2)
            peek() = '*' → eat('*')
            right = parseUnaryExpression() → parseAtom() → NumberLiteral(3)
            → return BinaryExpression(2 * 3)
  → return BinaryExpression(1 + BinaryExpression(2 * 3))
```

AST kết quả:

```
      [+]
     /   \
   [1]   [*]
         / \
       [2] [3]
```

---

## Pattern của mỗi tầng binary expression

Tất cả các tầng từ `parseOrExpression()` đến `parseMultiplicativeExpression()` đều theo cùng một pattern:

```typescript
private parseAdditiveExpression(): Expression {
    // 1. Gọi tầng dưới để lấy leftNode
    let leftNode = this.parseMultiplicativeExpression()

    // 2. Vòng lặp: chừng nào token hiện tại là operator của tầng này
    while (
        this.tokenManager.peek().type === '+' ||
        this.tokenManager.peek().type === '-'
    ) {
        // 3. Eat operator
        const operator = this.tokenManager.eat(['+', '-']).type as '+' | '-'

        // 4. Gọi tầng dưới để lấy rightNode
        const rightNode = this.parseMultiplicativeExpression()

        // 5. Bọc lại thành BinaryExpression — leftNode trở thành node mới
        leftNode = {
            id: uuid(),
            location: { start: leftNode.location.start, end: rightNode.location.end },
            type: 'BinaryExpression',
            leftNode,
            operator,
            rightNode,
        }
    }

    return leftNode
}
```

Vì dùng `while` thay vì `if`, pattern này tự động handle **left-associativity**:

```
1 + 2 + 3  →  (1 + 2) + 3   (không phải  1 + (2 + 3))
```

AST:

```
      [+]
     /   \
   [+]   [3]
   / \
 [1] [2]
```

---

## Đệ quy — nơi nó thực sự xảy ra

### Đệ quy trong Block

`parseBlock()` được gọi ở 3 chỗ: body của `if`, `while`, và `fn`. Bên trong `parseBlock()` lại gọi `parseStatement()`, và `parseStatement()` có thể gọi `parseFunctionDeclaration()`, rồi lại gọi `parseBlock()`:

```
fn outer() {
    fn inner() {   ← parseFunctionDeclaration() gọi parseBlock()
        return 1;      ← bên trong parseBlock() gọi parseStatement()
    }                      ← rồi lại parseFunctionDeclaration() → parseBlock()
}
```

Call stack thực tế:

```
parse()
  parseBlock()
    parseStatement()
      parseFunctionDeclaration()   ← outer
        parseBlock()
          parseStatement()
            parseFunctionDeclaration()   ← inner
              parseBlock()
                parseStatement()
                  parseReturnStatement()
```

### Đệ quy trong UnaryExpression

`parseUnaryExpression()` gọi chính nó để handle `!!true` hoặc `--x`:

```typescript
private parseUnaryExpression(): Expression {
    if (isUnaryExpressionLookahead(this.tokenManager.peek())) {
        const operator = this.tokenManager.eat(['!', '-', '+']).type
        const argument = this.parseUnaryExpression()  // ← đệ quy
        return { type: 'UnaryExpression', operator, argument, ... }
    }
    return this.parseAccessOrCallExpression()
}
```

`!!true` tạo ra:

```
    [!]
     |
    [!]
     |
  [true]
```

### Đệ quy trong Expression

`parseExpression()` gọi các tầng, và các tầng có thể gặp `(` → `parseParenthesizedExpression()` → `parseExpression()`:

```
1 * (2 + 3)
```

```
parseMultiplicativeExpression()
  left = parseUnaryExpression()
           parseAccessOrCallExpression()
             parseAtom() → NumberLiteral(1)
  peek() = '*' → eat('*')
  right = parseUnaryExpression()
            parseAccessOrCallExpression()
              parseAtom()
                peek() = '(' → parseParenthesizedExpression()
                  eat('(')
                  parseExpression()    ← đệ quy quay lại từ đầu
                    parseAdditiveExpression()
                      left = NumberLiteral(2)
                      peek() = '+' → eat('+')
                      right = NumberLiteral(3)
                      → BinaryExpression(2 + 3)
                  eat(')')
                  → ParenthesizedExpression(2 + 3)
```

AST:

```
        [*]
       /   \
     [1]  [(2+3)]
            |
           [+]
           / \
         [2] [3]
```

---

## AccessOrCall — left-to-right chaining

`parseAccessOrCallExpression()` xử lý `.`, `[]`, `()` sau một atom bằng vòng lặp — mỗi lần lặp **bọc node cũ vào target của node mới**:

```
obj.items[0]()
```

Bước 1 — `parseAtom()` → `Identifier('obj')`

```
[obj]
```

Bước 2 — gặp `.` → `PropAccess`

```
    [PropAccess]
     /          \
  [obj]       [items]
  target      property
```

Bước 3 — gặp `[` → `ElementAccess`

```
        [ElementAccess]
         /             \
    [PropAccess]       [0]
     /       \         index
  [obj]    [items]
```

Bước 4 — gặp `(` → `Call`

```
          [Call]
          /     \
[ElementAccess]  []
  /          \   args
[PropAccess] [0]
 /       \
[obj]  [items]
```

Không có đệ quy ở đây — chỉ là vòng lặp `while(true)` với `break` khi không còn `.`, `[]`, `()`.

---

## IfStatement — else if chain

```
if (a) {
    ...
} else if (b) {
    ...
} else {
    ...
}
```

AST:

```
IfStatement
├── condition: Identifier('a')
├── body: Block[...]
├── elseIf:
│     └── ElseIf
│           ├── condition: Identifier('b')
│           └── body: Block[...]
└── else: Block[...]
```

Parser dùng vòng lặp `while` để đọc nhiều `else if` liên tiếp:

```typescript
while (this.tokenManager.peek().type === 'else') {
    this.tokenManager.eat('else');
    if (this.tokenManager.peek().type === 'if') {
        // else if branch → push vào elseIf[]
    } else {
        // else branch → gán vào elseBranch, break
        break;
    }
}
```

---

## AssignmentOrExpression — một token quyết định tất cả

```typescript
parseAssignmentOrExpressionStatement() {
    const left = this.parseExpression()   // parse left side trước

    if (this.tokenManager.peek().type === '=') {
        // Đây là assignment: x = 42;
        this.tokenManager.eat('=')
        const right = this.parseExpression()
        this.tokenManager.eat(';')
        return AssignmentStatement { left, right }
    }

    // Không có '=' → đây là expression statement: print(x);
    this.tokenManager.eat(';')
    return ExpressionStatement { expression: left }
}
```

Parse `left` trước, **sau đó mới quyết định** đây là assignment hay expression statement dựa vào token `=`.

---

## Ví dụ đầy đủ: `fib(n - 1)`

Tokens: `IDENTIFIER(fib)` `(` `IDENTIFIER(n)` `-` `NUMBER(1)` `)`

```
parseExpression()
  parseOrExpression()
    ...
      parseAdditiveExpression()
        left = parseMultiplicativeExpression()
                 parseUnaryExpression()
                   parseAccessOrCallExpression()
                     parseAtom() → Identifier('fib')
                     peek() = '(' → Call!
                       eat('(')
                       isExpressionLookahead → parseExpressionList()
                         parseExpression()
                           parseAdditiveExpression()
                             left = Identifier('n')
                             peek() = '-' → eat('-')
                             right = NumberLiteral(1)
                             → BinaryExpression(n - 1)
                       eat(')')
                     → Call { target: fib, args: [BinaryExpression(n-1)] }
```

AST:

```
       [Call]
      /       \
  [fib]    [args]
              |
             [-]
             / \
           [n] [1]
```

---

## Tóm tắt các nguyên tắc

| Nguyên tắc                      | Cách áp dụng                                   |
| ------------------------------- | ---------------------------------------------- |
| Peek trước, eat sau             | `parseStatement()` chỉ peek, để method con eat |
| Một method = một grammar rule   | `parseIfStatement()` chỉ biết về `if`          |
| Tầng dưới = độ ưu tiên cao hơn  | `*` ở tầng dưới `+` → tính trước               |
| Đệ quy cho cấu trúc lồng nhau   | Block → Statement → Block (fn trong fn)        |
| Vòng lặp cho left-associativity | `1 + 2 + 3` → `(1+2)+3`                        |
| Left side trước, quyết định sau | Assignment vs ExpressionStatement              |
