import { uuid } from '../utils';
import type { ASTNode, FunctionDeclaration } from '../frontend/ast';

export type Pointer = string;

// Primitives
type NumberValue = { type: 'number'; value: number };
type StringValue = { type: 'string'; value: string };
type BooleanValue = { type: 'boolean'; value: boolean };
type NullValue = { type: 'null' };

// Reference types (lưu Pointer thay vì value)
export type ArrayValue = { type: 'array'; elements: Pointer[] };
export type ObjectValue = { type: 'object'; properties: Record<string, Pointer> };

// Function types:
// - builtinfunction: hàm built-in (print, length...), impl là JS function thực thi trực tiếp
// - function: hàm do người dùng định nghĩa, lưu AST node và parentEnv để support closure
export type FunctionValue =
    | { type: 'builtinfunction'; impl: (args: Pointer[]) => Pointer }
    | { type: 'function'; node: FunctionDeclaration; parentEnv: LexicalEnvironment };

export type PrimitiveValue = NumberValue | StringValue | BooleanValue | NullValue;
export type RuntimeValue = PrimitiveValue | ArrayValue | ObjectValue | FunctionValue;

// Ép kiểu về String
export function coerceString(primitive: PrimitiveValue): string {
    switch (primitive.type) {
        case 'string':
            return primitive.value;
        case 'number':
        case 'boolean':
            return String(primitive.value);
        case 'null':
            return 'null';
    }
}

// Thu hẹp RuntimeValue xuống PrimitiveValue
export function isPrimitive(runtimeValue: RuntimeValue): runtimeValue is PrimitiveValue {
    return (
        runtimeValue.type === 'number' ||
        runtimeValue.type === 'string' ||
        runtimeValue.type === 'boolean' ||
        runtimeValue.type === 'null'
    );
}

// Dùng trong WhileLoop và IfStatement để quyết định có execute body không
export function isTruthy(runtimeValue: RuntimeValue): boolean {
    if (runtimeValue.type === 'number' && runtimeValue.value === 0) return false;
    if (runtimeValue.type === 'string' && runtimeValue.value === '') return false;
    if (runtimeValue.type === 'boolean' && runtimeValue.value === false) return false;
    if (runtimeValue.type === 'null') return false;

    return true;
}

export function isPrimitiveEqual(a: PrimitiveValue, b: PrimitiveValue): boolean {
    if (a.type === 'number' && b.type === 'number') return a.value === b.value;
    if (a.type === 'string' && b.type === 'string') return a.value === b.value;
    if (a.type === 'boolean' && b.type === 'boolean') return a.value === b.value;
    if (a.type === 'null' && b.type === 'null') return true;

    return false;
}

// Storage cho tất cả RuntimeValue
// Mọi value đều sống trên Heap, code chỉ truyền Pointer, không truyền value trực tiếp
export class Heap {
    private readonly storage: Record<Pointer, RuntimeValue> = {};

    // Lấy value theo Pointer, throw error nếu Pointer không tồn tại
    public get(pointer: Pointer): RuntimeValue {
        if (this.storage[pointer] !== undefined) return this.storage[pointer];

        throw new Error(`Segmentation fault: invalid pointer ${pointer}`);
    }

    // Tạo Pointer mới, lưu value, trả về Pointer, caller không tự tạo Pointer
    public set(runtimeValue: RuntimeValue): Pointer {
        const pointer: Pointer = uuid();
        this.storage[pointer] = runtimeValue;

        return pointer;
    }

    // Trả về toàn bộ storage, dùng bởi diagnostics.ts để snapshot Heap cho UI
    public all(): Record<Pointer, RuntimeValue> {
        return this.storage;
    }
}

export type VariableName = string;
// Scope của một function call, lưu mapping tên biến → Pointer trong Heap
export class LexicalEnvironment {
    private readonly localVariables: Record<VariableName, Pointer> = {}; // Lưu mapping từ tên biến → pointer trong Heap
    private readonly parent?: LexicalEnvironment; // Optional - scope global không có parent

    constructor(parent?: LexicalEnvironment) {
        this.parent = parent;
    }

    // Tìm một biến trong scope hiện tại, không có thì tìm lên parent, return undefined nếu không tìm thấy ở bất kỳ scope nào
    get(variableName: VariableName): Pointer | undefined {
        const pointer = this.localVariables[variableName];

        if (pointer !== undefined) return pointer;

        if (this.parent) return this.parent.get(variableName);
    }

    // Dùng khi khởi tạo một biến, luôn set vào scope hiện tại, không leo lên parent
    set(variableName: VariableName, pointer: Pointer) {
        this.localVariables[variableName] = pointer;
    }

    // Chỉ trả về localVariables của scope này, không include parent, dùng bởi diagnostics.ts để hiển thị local variables trong stack frame
    all(): Record<VariableName, Pointer> {
        return this.localVariables;
    }
}

interface Frame {
    id: string;
    functionName: string;
    currentNode: ASTNode; // Node AST đang execute trong frame - dùng để highlight dòng code trên UI
    environment: LexicalEnvironment;
}

// Stack của các execution frames, mỗi function call tạo một Frame mới
export class CallStack {
    private readonly frames: Frame[] = [];

    public push(functionName: string, currentNode: ASTNode, environment: LexicalEnvironment) {
        this.frames.push({
            id: uuid(),
            functionName: functionName,
            currentNode: currentNode,
            environment: environment,
        });
    }

    public pop() {
        this.frames.pop();
    }

    // peek() là Frame đang active trên cùng của stack, bị pop khi function return
    public peek(): Frame {
        return this.frames[this.frames.length - 1];
    }

    // Toàn bộ stack, dùng bởi diagnostics.ts để hiển thị call stack trên UI
    public all(): Frame[] {
        return this.frames;
    }
}
