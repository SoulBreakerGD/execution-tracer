import type { ASTNode } from '../frontend/ast';
import type { Accumulator, BlockContext, Context, ExpressionStatementContext, PrimitiveContext } from './context';
import { CallStack, Heap } from './memory';

export function initialContext(node: ASTNode): Context {
    switch (node.type) {
        case 'Block':
            return { type: 'Block', node: node, programCounter: 0 };
        case 'Identifier':
            return { type: 'Primitive', node: node, phase: 'init' };
        case 'ExpressionStatement':
            return { type: 'ExpressionStatement', node: node, phase: 'init' };
        default:
            throw new Error();
    }
}

interface State {
    heap: Heap;
    callStack: CallStack;
    executionStack: Context[];
    accumulator: Accumulator;
}

export function executeBlock(context: BlockContext, state: State) {
    if (context.programCounter === context.node.statements.length) {
        state.executionStack.pop();
        return;
    }

    const nextStatement = context.node.statements[context.programCounter];
    context.programCounter++;
    state.executionStack.push(initialContext(nextStatement));
}

export function executePrimitive(context: PrimitiveContext, state: State) {
    // - `init`: tạo RuntimeValue trên Heap, ghi Pointer vào `accumulator.value`
    // - `done`: pop
    if (context.phase === 'init') {
        switch (context.node.type) {
            case 'NumberLiteral':
                state.accumulator.value = state.heap.set({ type: 'number', value: context.node.value });
                break;
            case 'StringLiteral':
                state.accumulator.value = state.heap.set({ type: 'string', value: context.node.value });
                break;
            case 'BooleanLiteral':
                state.accumulator.value = state.heap.set({ type: 'boolean', value: context.node.value });
                break;
            case 'NullLiteral':
                state.accumulator.value = state.heap.set({ type: 'null' });
                break;
            case 'Identifier':
                const pointer = state.callStack.peek().environment.get(context.node.name);
                if (pointer === undefined) {
                    throw new Error(`ReferenceError: ${context.node.name} is not defined`);
                }
                state.accumulator.value = pointer;
                break;
        }

        context.phase = 'done';
        return;
    }

    if (context.phase === 'done') {
        state.executionStack.pop();
        return;
    }
}

export function executeExpressionStatement(context: ExpressionStatementContext, state: State) {
    // - `init`: push inner expression vào `executionStack`
    // - `done`: kết quả bị bỏ qua (statement không return value) → pop
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.expression));
        context.phase = 'done';
        return;
    }

    if (context.phase === 'done') {
        state.executionStack.pop();
        return;
    }
}

export function execute(context: Context, state: State) {
    switch (context.type) {
        case 'Block':
            return executeBlock(context, state);
        case 'Primitive':
            return executePrimitive(context, state);
        case 'ExpressionStatement':
            return executeExpressionStatement(context, state);
    }
}
