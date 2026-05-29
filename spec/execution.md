# Execution — Từ AST đến Runtime

## Luồng tổng quan

```
Source code (string)
    ↓ Tokenizer.tokenize()
Token[]
    ↓ new TokenManager(tokens)
TokenManager
    ↓ new Parser(tokenManager).parse()
Block (root AST node)
    ↓ executor(ast)
Executor (đã setup Heap, Env, CallStack, executionStack)
    ↓ executor.advance()
ExecutionState { printed, finished, stack, heap }
```

---

## executor() — Setup trước khi chạy

```
Heap rỗng
    ↓ set builtin functions (print, len, push, pop, del)
    → mỗi function là một Pointer trên Heap

builtinEnvironment
    → set print=ptr, len=ptr, push=ptr, pop=ptr, del=ptr

globalEnvironment (parent = builtinEnvironment)
    → scope người dùng chạy ở đây
    → lookup biến leo lên builtinEnvironment nếu không thấy

CallStack
    → push Frame { functionName: 'global', node: program, environment: globalEnvironment }

executionStack
    → [ BlockContext { node: program, programCounter: 0 } ]

accumulator
    → { value: null_pointer, isReturn: false }
```

---

## advance() — Vòng lặp chính

```typescript
while (executionStack.length > 0) {
    currentContext = executionStack[last];

    // Pause nếu gặp breakpoint chưa xử lý
    if (breakpoints.has(currentContext.node.id) && !currentContext.breakpoint) {
        currentContext.breakpoint = true;
        return state();
    }

    execute(currentContext, { heap, callStack, executionStack, accumulator });
}
return state(); // executionStack rỗng → finished = true
```

Mỗi lần `execute()` làm **đúng một việc nhỏ** — push context mới hoặc pop context hiện tại. Không bao giờ xử lý cả node trong một lần.

---

## initialContext() — Mapping từ AST node → Context

```typescript
// Mỗi AST node type map sang một Context type tương ứng
Block              → BlockContext          { programCounter: 0 }
NumberLiteral      → PrimitiveContext      { phase: 'init' }
Identifier         → PrimitiveContext      { phase: 'init' }
BinaryExpression   → BinaryExpressionContext { phase: 'init', left: undefined }
Call               → CallContext           { phase: 'init', args: [] }
IfStatement        → IfStatementContext    { phase: 'init' }
WhileLoop          → WhileLoopContext      { phase: 'init' }
// ... tất cả node types đều có Context tương ứng
```

---

## Ví dụ cụ thể: `computeFibonacci(5)`

Khi `advance()` được gọi với program trên, executionStack bắt đầu từ root Block và mở rộng dần:

```
[1] BlockContext pc=0
    → push ExpressionStatementContext (FunctionDeclaration computeFibonacci)
    → pc=1

[2] ExpressionStatementContext phase='init'
    → push FunctionDeclarationContext
    → phase='done'

[3] FunctionDeclarationContext
    → tạo FunctionValue { node, parentEnv: globalEnv } trên Heap
    → globalEnv.set('computeFibonacci', pointer)
    → pop ← một bước là xong, không có phase

[4] ExpressionStatementContext phase='done'
    → kết quả bỏ qua → pop

[5] BlockContext pc=1
    → push context của statement tiếp theo...
    (tiếp tục cho đến khi gặp Call computeFibonacci(5))

[6] CallContext phase='init'
    → push PrimitiveContext { Identifier('computeFibonacci') }
    → phase='targetcomputed'

[7] PrimitiveContext phase='init' (Identifier)
    → lookup 'computeFibonacci' trong globalEnv → tìm thấy → accumulator.value = ptr
    → phase='done'

[8] PrimitiveContext phase='done' → pop

[9] CallContext phase='targetcomputed'
    → context.target = accumulator.value (FunctionValue pointer)
    → push PrimitiveContext { NumberLiteral(5) }
    → phase='argcomputed'

[10] PrimitiveContext NumberLiteral(5)
    → heap.set({ type:'number', value:5 }) → accumulator.value = ptr5
    → phase='done' → pop

[11] CallContext phase='argcomputed'
    → context.args.push(ptr5) ← tất cả args đã xong
    → phase='callready'

[12] CallContext phase='callready'
    → heap.get(target) → FunctionValue { node: FunctionDeclaration, parentEnv: globalEnv }
    → newEnv = new LexicalEnvironment(parentEnv) ← closure!
    → newEnv.set('n', ptr5)
    → callStack.push('computeFibonacci', node, newEnv)
    → push BlockContext { node: body, pc: 0 }
    → phase='done'

[13] ... body của computeFibonacci execute
    → IfStatement → BinaryExpression (n <= 1) → false
    → else branch → ReturnStatement
    → BinaryExpression: computeFibonacci(n-1) + computeFibonacci(n-2)
    → đệ quy tiếp tục...

[n] ReturnStatement
    → accumulator.value = kết quả cuối cùng
    → accumulator.isReturn = true

[n+1] BlockContext thấy isReturn = true → pop (không execute tiếp)
[n+2] CallContext phase='done' thấy isReturn = true
    → callStack.pop()
    → accumulator.isReturn = false ← reset, return đã handled
    → accumulator.value giữ nguyên (kết quả của call)
    → pop

executionStack rỗng → finished = true
```

---

## state() — Snapshot tại mỗi bước

```typescript
private state(): ExecutionState {
    const printed = [...this.printed]
    this.printed.length = 0  // clear buffer sau mỗi advance()
    return {
        printed,
        finished: executionStack.length === 0,
        stack: stackDiagnostic(callStack),   // frames hiện tại
        heap:  heapSnapshot(heap),           // tất cả values trên Heap
    }
}
```

UI dùng `ExecutionState` để hiển thị: call stack, heap values, output, và highlight dòng code đang chạy.
