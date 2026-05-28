import type { ASTNodeId, Block } from '../frontend/ast';
import type { Accumulator, Context } from './context';
import { execute, initialContext } from './execution';
import { CallStack, Heap, LexicalEnvironment } from './memory';

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
export function executor(program: Block): Executor {
    const printed: string[] = [];
    const heap = new Heap();
    const callStack = new CallStack();
    const buildinEnvironment = new LexicalEnvironment();
    const globalEnvironment = new LexicalEnvironment();

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

            if (this.breakpoints.has(currentContext.node.id)) return this.state();
            // execute() có thể thay đổi trạng thái của Heap/Stack
            execute(currentContext, {
                heap: this.heap,
                callStack: this.callStack,
                executionStack: this.executionStack,
                accumulator: this.accumulator,
            });
        }
    }

    // Lưu trạng thái hiện tại bao gồm Heap/Stack snapshot
    private state() {}
}
