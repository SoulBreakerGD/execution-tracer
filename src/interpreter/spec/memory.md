# Memory — Cách Interpreter quản lý values lúc runtime

## Tổng quan

Có 4 thành phần chính:

```
RuntimeValue        — định nghĩa các loại giá trị có thể tồn tại
Heap                — kho lưu trữ tất cả values, truy cập qua Pointer
LexicalEnvironment  — scope của một block code, map tên biến → Pointer
CallStack           — stack các function frames đang active
```

---

## Pointer

Thay vì truyền value trực tiếp giữa các bước, Interpreter truyền **Pointer** — một UUID string đại diện cho địa chỉ của value trong Heap:

```
Pointer = "abc-123"  →  Heap["abc-123"] = { type: 'number', value: 42 }
```

Lý do: array và object cần **pass by reference** — nhiều biến có thể trỏ vào cùng một value. Nếu `a` và `b` cùng trỏ vào một array, thay đổi qua `a` sẽ thấy được qua `b`.

```
env: { a → "ptr-1", b → "ptr-1" }
heap: { "ptr-1": { type: 'array', elements: [...] } }
```

---

## RuntimeValue — các loại giá trị

```
Primitives (lưu thẳng value):
  BooleanValue   { type: 'boolean', value: boolean }
  NumberValue    { type: 'number',  value: number  }
  StringValue    { type: 'string',  value: string  }
  NullValue      { type: 'null'                    }

Reference types (lưu Pointer thay vì value):
  ArrayValue     { type: 'array',  elements: Pointer[]               }
  ObjectValue    { type: 'object', properties: Record<string, Pointer> }

Function types:
  FunctionValue  { type: 'function', node: FunctionDeclaration, parentEnv: LexicalEnvironment }
  BuiltinFunction { type: 'builtinfunction', impl: (args: Pointer[]) => Pointer }
```

`FunctionValue` lưu `parentEnv` — đây là cách **closure** hoạt động. Khi hàm được gọi, nó dùng `parentEnv` để lookup biến từ scope nơi nó được **định nghĩa**, không phải nơi nó được **gọi**.

---

## Heap — kho lưu trữ trung tâm

```
Heap = {
  "ptr-1": { type: 'number', value: 42 },
  "ptr-2": { type: 'string', value: "hello" },
  "ptr-3": { type: 'array', elements: ["ptr-1", "ptr-2"] }
}
```

Heap chỉ có 2 operations:

- `set(value)` — lưu value, tạo Pointer mới, trả về Pointer
- `get(ptr)` — đọc value từ Pointer, throw nếu không tồn tại

---

## LexicalEnvironment — scope chain

Map từ **tên biến** → **Pointer**:

```
globalEnv:  { x → "ptr-1", add → "ptr-5" }
    ↑ parent
localEnv:   { n → "ptr-2", result → "ptr-3" }
```

Khi lookup biến `x` từ `localEnv`:

1. Tìm trong `localEnv.variables` → không có
2. Tìm trong `parent` (globalEnv) → tìm thấy → trả về Pointer

Mỗi function call tạo ra một `LexicalEnvironment` mới với `parent` trỏ vào scope bên ngoài — đây là cách **scope chain** và **closure** hoạt động.

---

## CallStack — stack các function frames

Mỗi function call push một **Frame** vào stack:

```
CallStack = [
  Frame { functionName: '',     currentNode: Block,           environment: globalEnv }   ← global
  Frame { functionName: 'fib',  currentNode: IfStatement,     environment: fibEnv    }   ← đang trong fib()
  Frame { functionName: 'fib',  currentNode: BinaryExpression, environment: fibEnv2  }   ← đệ quy fib()
]
```

`currentNode` là node AST **đang được execute** trong frame đó — dùng để hiển thị "đang chạy dòng nào" trên UI.

---

## Helper functions

**`isPrimitive(v)`** — type guard, trả về `true` nếu v là primitive:

```
isPrimitive({ type: 'number', value: 42 }) → true
isPrimitive({ type: 'array', elements: [] }) → false
```

**`isTruthy(v)`** — falsy values: `null`, `false`, `0`, `""` — còn lại là truthy

**`isPrimitiveEqual(a, b)`** — so sánh 2 primitives có bằng nhau không — cần check cùng type trước
