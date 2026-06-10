import type { ASTNodeId, Block } from '../frontend/ast';
import { printAny } from './builtin';
import type { Accumulator, Context } from './context';
import { type DiagnosticFrame, heapSnapshot, type HeapSnapshot, stackDiagnostic } from './diagnostics';
import { execute, initialContext } from './execution';
import { CallStack, Heap, LexicalEnvironment, type Pointer } from './memory';

interface Config {
    heap: Heap;
    callStack: CallStack;
    output: string[]; // Output khi gọi hàm print()
    program: Block;
}

interface ExecutionState {
    output: string[];
    finished: boolean;
    callStack: DiagnosticFrame[];
    heap: HeapSnapshot;
}

// Dùng để initialize các thuộc tính trong Executor
// Đầu vào là toàn bộ program, một Block AST
export function executor(program: Block): Executor {
    const output: string[] = [];
    const heap = new Heap();
    const callStack = new CallStack();
    const builtinEnvironment = new LexicalEnvironment();

    // Print builtin function: Chuyển đổi các RuntimeValue thành chuỗi và lưu vào buffer 'output'
    const printPointer = heap.set({
        type: 'builtinfunction',
        impl: (args: Pointer[]) => {
            const strings: string[] = [];

            for (const argumentPointer of args) {
                strings.push(printAny(heap, heap.get(argumentPointer)));
            }

            output.push(strings.join(' '));

            // Hàm print trong ngôn ngữ này không trả về giá trị (null)
            return heap.set({ type: 'null' });
        },
    });

    // Len (length) builtin function
    const lenPointer = heap.set({
        type: 'builtinfunction',
        impl: (args: Pointer[]) => {
            if (args.length !== 1) {
                throw new Error(`Expected 1 argument, but got ${args.length}`);
            }

            const array = heap.get(args[0]);
            if (array.type !== 'array') {
                throw new Error(`Expected array, but got ${array.type}`);
            }

            // Trả về một RuntimeValue kiểu 'number' chứa độ dài mảng
            return heap.set({ type: 'number', value: array.elements.length });
        },
    });

    // Push builtin function
    const pushPointer = heap.set({
        type: 'builtinfunction',
        impl: (args: Pointer[]) => {
            if (args.length !== 2) {
                throw new Error(`Expected 2 arguments, but got ${args.length}`);
            }

            const array = heap.get(args[0]);
            if (array.type !== 'array') {
                throw new Error(`Expected array, but got ${array.type}`);
            }

            // Thêm Pointer của phần tử mới vào mảng Pointer của ArrayValue
            array.elements.push(args[1]);
            return args[1]; // Trả về chính phần tử vừa push
        },
    });

    // Pop builtin function
    const popPointer = heap.set({
        type: 'builtinfunction',
        impl: (args: Pointer[]) => {
            if (args.length !== 1) {
                throw new Error(`Expected 1 argument, but got ${args.length}`);
            }

            const array = heap.get(args[0]);
            if (array.type !== 'array') {
                throw new Error(`Expected array, but got ${array.type}`);
            }

            // Lấy Pointer cuối cùng ra khỏi mảng, nếu rỗng thì trả về Pointer đến 'null'
            return array.elements.pop() ?? heap.set({ type: 'null' });
        },
    });

    // Del (delete) builtin function
    const delPointer = heap.set({
        type: 'builtinfunction',
        impl: (args: Pointer[]) => {
            if (args.length !== 2) {
                throw new Error(`Expected 2 arguments, but got ${args.length}`);
            }

            const object = heap.get(args[0]);
            if (object.type !== 'object') {
                throw new Error(`Expected object, but got ${object.type}`);
            }

            const key = heap.get(args[1]);
            if (key.type !== 'string') {
                throw new Error(`Expected string, but got ${key.type}`);
            }

            // Xóa mapping của key trong object properties trên Heap
            delete object.properties[key.value];
            return heap.set({ type: 'null' });
        },
    });

    builtinEnvironment.set('print', printPointer);
    builtinEnvironment.set('len', lenPointer);
    builtinEnvironment.set('push', pushPointer);
    builtinEnvironment.set('pop', popPointer);
    builtinEnvironment.set('del', delPointer);

    const globalEnvironment = new LexicalEnvironment(builtinEnvironment);
    callStack.push('global', program, globalEnvironment);

    return new Executor({ program, heap, callStack, output });
}

// Một state machine tự quản lý executionStack để hỗ trợ program breakpoints hoặc pause execution vì không thể làm với đệ quy JS thông thường
export class Executor {
    private readonly heap: Heap;
    private readonly callStack: CallStack;
    private readonly output: string[];
    private readonly executionStack: Context[]; // Giả lập recursive stack để quản lý thay vì recursive traverse AST
    private readonly breakpoints: Set<ASTNodeId> = new Set();
    private readonly accumulator: Accumulator;

    constructor(config: Config) {
        this.heap = config.heap;
        this.callStack = config.callStack;
        this.output = config.output;
        this.executionStack = [initialContext(config.program)];
        this.accumulator = { value: this.heap.set({ type: 'null' }), isReturn: false };
    }

    addBreakpoint(id: ASTNodeId) {
        this.breakpoints.add(id);
    }

    clearBreakpoints() {
        this.breakpoints.clear();
    }

    // Chạy đến khi hết program hoặc gặp breakpoint
    advance() {
        while (this.executionStack.length > 0) {
            const currentContext = this.executionStack[this.executionStack.length - 1];

            if (this.breakpoints.has(currentContext.node.id) && !currentContext.breakpoint) {
                currentContext.breakpoint = true;
                return this.state();
            }

            // execute() có thể thay đổi trạng thái của Heap/Stack
            execute(currentContext, {
                heap: this.heap,
                callStack: this.callStack,
                executionStack: this.executionStack,
                accumulator: this.accumulator,
            });
        }

        return this.state();
    }

    // Lưu trạng thái hiện tại bao gồm Heap/Stack snapshot
    private state(): ExecutionState {
        const output = [...this.output];
        this.output.length = 0; // Clear buffer sau mỗi advance()
        return {
            output,
            finished: this.executionStack.length === 0,
            callStack: stackDiagnostic(this.callStack),
            heap: heapSnapshot(this.heap),
        };
    }
}
