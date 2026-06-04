import type { ASTNodeId, Block } from '../frontend/ast';
import { printAny } from './buildin';
import type { Accumulator, Context } from './context';
import { execute, initialContext } from './execution';
import { CallStack, Heap, LexicalEnvironment, Pointer } from './memory';

interface Config {
    heap: Heap;
    callStack: CallStack;
    printed: string[]; // Output khi gọi hàm print()
    program: Block;
}

interface ExecutionState {
    printed: string[];
    finished: boolean;
}

// Dùng để initialize các thuộc tính trong Executor
// Đầu vào là toàn bộ program, một Block AST
export function executor(program: Block): Executor {
    const printed: string[] = [];
    const heap = new Heap();
    const callStack = new CallStack();
    const buildinEnvironment = new LexicalEnvironment();

    // Print builtin function
    const printPointer = heap.set({
        type: 'builtinfunction',
        impl: (args: Pointer[]) => {
            const strings: string[] = [];

            for (const argumentPointer of args) {
                strings.push(printAny(heap, heap.get(argumentPointer)));
            }

            printed.push(strings.join(' '));

            return heap.set({ type: 'null' });
        },
    });

    // Len (length) buildin function
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

            return heap.set({ type: 'number', value: array.elements.length });
        },
    });

    // Push buildin function
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

            array.elements.push(args[1]);
            return args[1];
        },
    });

    // Pop buildin function
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

            // Nếu array rỗng thì trả về Pointer đến null
            return array.elements.pop() || heap.set({ type: 'null' });
        },
    });

    // Del (delete) buildin function
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

            delete object.properties[key.value];
            return heap.set({ type: 'null' });
        },
    });

    buildinEnvironment.set('print', printPointer);
    buildinEnvironment.set('len', lenPointer);
    buildinEnvironment.set('push', pushPointer);
    buildinEnvironment.set('pop', popPointer);
    buildinEnvironment.set('del', delPointer);

    const globalEnvironment = new LexicalEnvironment(buildinEnvironment);
    callStack.push('global', program, globalEnvironment);

    return new Executor({ program, heap, callStack, printed });
}

// Một state machine tự quản lý executionStack để hỗ trợ program breakpoints hoặc pause execution vì không thể làm với đệ quy JS thông thường
class Executor {
    private readonly heap: Heap;
    private readonly callStack: CallStack;
    private readonly printed: string[];
    private readonly executionStack: Context[]; // Giả lập recursive stack để quản lý thay vì recursive traverse AST
    private readonly breakpoints: Set<ASTNodeId> = new Set();
    private readonly accumulator: Accumulator;

    constructor(config: Config) {
        this.heap = config.heap;
        this.callStack = config.callStack;
        this.printed = config.printed;
        this.executionStack = [initialContext(config.program)];
        this.accumulator = { value: this.heap.set({ type: 'null' }), isReturn: false };
    }

    addBreakpoint(id: ASTNodeId) {
        this.breakpoints.add(id);
    }

    clearBreakpoint() {
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
    private state(): string[] {
        const printed = [...this.printed];
        this.printed.length = 0;
        return printed;
    }
}
