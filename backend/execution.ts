import type { ASTNode, IfStatement } from '../frontend/ast';
import type {
    Accumulator,
    BinaryExpressionContext,
    BlockContext,
    CallContext,
    Context,
    ElementAccessContext,
    ElseIfContext,
    ExpressionStatementContext,
    FunctionDeclarationContext,
    IfStatementContext,
    ParenthesizedExpressionContext,
    PrimitiveContext,
    PropAccessContext,
    ReturnStatementContext,
    UnaryExpressionContext,
    WhileLoopContext,
} from './context';
import { CallStack, Heap, isPrimitive, isPrimitiveEqual, isTruthy, LexicalEnvironment } from './memory';

function initialElseIfContext(node: IfStatement, index: number): ElseIfContext {
    return { type: 'ElseIf', node: node, phase: 'init', index: index };
}

export function initialContext(node: ASTNode): Context {
    switch (node.type) {
        case 'Block':
            return { type: 'Block', node: node, programCounter: 0 };
        case 'NumberLiteral':
        case 'StringLiteral':
        case 'BooleanLiteral':
        case 'NullLiteral':
        case 'Identifier':
            return { type: 'Primitive', node: node, phase: 'init' };
        case 'ExpressionStatement':
            return { type: 'ExpressionStatement', node: node, phase: 'init' };
        case 'ParenthesizedExpression':
            return { type: 'ParenthesizedExpression', node: node, phase: 'init' };
        // case 'ArrayLiteral':
        // case 'ObjectLiteral':
        case 'BinaryExpression':
            return { type: 'BinaryExpression', node: node, phase: 'init' };
        case 'UnaryExpression':
            return { type: 'UnaryExpression', node: node, phase: 'init' };
        case 'PropAccess':
            return { type: 'PropAccess', node: node, phase: 'init' };
        case 'ElementAccess':
            return { type: 'ElementAccess', node: node, phase: 'init' };
        case 'Call':
            return { type: 'Call', node: node, phase: 'init', args: [] };
        case 'IfStatement':
            return { type: 'IfStatement', node: node, phase: 'init' };
        case 'WhileLoop':
            return { type: 'WhileLoop', node: node, phase: 'init' };
        case 'FunctionDeclaration':
            return { type: 'FunctionDeclaration', node: node };
        case 'ReturnStatement':
            return { type: 'ReturnStatement', node: node, phase: 'init' };
        // case 'AssignmentStatement':
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

// Execute Block { ... } - iterate qua từng statement theo programCounter
// Không có phase - programCounter đóng vai trò bookmark thay thế
// Mỗi lần được gọi: push statement tiếp theo vào executionStack, tăng programCounter
// Khi hết statements → pop Block khỏi executionStack
export function executeBlock(context: BlockContext, state: State) {
    if (context.programCounter === context.node.statements.length) {
        state.executionStack.pop();
        return;
    }

    const nextStatement = context.node.statements[context.programCounter];
    context.programCounter++;
    state.executionStack.push(initialContext(nextStatement));
}

// Execute Primitive - literal value hoặc identifier lookup
// init: tạo RuntimeValue tương ứng trên Heap, ghi Pointer vào accumulator.value
//       Identifier thì lookup trong LexicalEnvironment thay vì tạo value mới
//       Nếu không tìm thấy → throw ReferenceError
// done: parent đã đọc accumulator.value → pop
export function executePrimitive(context: PrimitiveContext, state: State) {
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
                // Traverse scope chain lên parent environments cho đến khi tìm thấy
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

// Execute Expression được bọc trong () - ví dụ: (x + 1) * 2
// Dấu ngoặc chỉ dùng để nhóm, không tạo ra value mới - chỉ cần execute expression bên trong
// init: Push inner expression vào executionStack
// done: accumulator.value đã có kết quả → pop
export function executeParenthesizedExpression(context: ParenthesizedExpressionContext, state: State) {
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

// - `init`: push `left` expression vào `executionStack`
// - `lhscomputed`: lưu `accumulator.value` vào `context.left`, push `right` expression
// - `rhscomputed`: có đủ `left` + `accumulator.value` (right) → apply operator → ghi kết quả vào `accumulator.value` → pop

// `left?: Pointer` - lưu tạm vì `accumulator.value` bị ghi đè khi tính `right`.
export function executeBinaryExpression(context: BinaryExpressionContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.left));
        context.phase = 'lhscomputed';

        return;
    }

    if (context.phase === 'lhscomputed') {
        context.left = state.accumulator.value;
        const leftValue = state.heap.get(context.left);

        // Short-circuit && — nếu left false thì không cần tính right
        if (context.node.operator === '&&' && !isTruthy(leftValue)) {
            state.accumulator.value = state.heap.set({ type: 'boolean', value: false });
            state.executionStack.pop();
            return;
        }

        // Short-circuit || — nếu left true thì không cần tính right
        if (context.node.operator === '||' && isTruthy(leftValue)) {
            state.accumulator.value = state.heap.set({ type: 'boolean', value: true });
            state.executionStack.pop();
            return;
        }

        state.executionStack.push(initialContext(context.node.right));
        context.phase = 'rhscomputed';

        return;
    }

    if (context.phase === 'rhscomputed') {
        const left = state.heap.get(context.left!);
        const right = state.heap.get(state.accumulator.value);

        // if (isPrimitive(left.right))
        // todo
        return;
    }
}

// - `init`: push `argument` expression vào `executionStack`
// - `argcomputed`: apply operator lên `accumulator.value` → ghi kết quả → pop
export function executeUnaryExpression(context: UnaryExpressionContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.argument));
        context.phase = 'argcomputed';

        return;
    }

    if (context.phase === 'argcomputed') {
        // todo
        // state.accumulator.value = state.heap.set(context.node.operator(state.heap.get(state.accumulator.value))
        state.executionStack.pop();

        return;
    }
}

// - `init`: push `target` expression vào `executionStack`
// - `targetcomputed`: lookup `property` trên `ObjectValue` → ghi Pointer vào `accumulator.value` → pop
export function executePropAccess(context: PropAccessContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.target));
        context.phase = 'targetcomputed';

        return;
    }

    if (context.phase === 'targetcomputed') {
        // todo
        state.executionStack.pop();

        return;
    }
}

// `init → targetcomputed → indexcomputed`

// - `init`: push `target` vào `executionStack`
// - `targetcomputed`: lưu `accumulator.value` vào `context.target`, push `index` expression
// - `indexcomputed`: dùng `target` + `accumulator.value` (index) → lookup element → ghi vào `accumulator.value` → pop

// `target?: Pointer` — lưu tạm vì `accumulator.value` bị ghi đè khi tính `index`.
export function executeElementAccess(context: ElementAccessContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.target));
        context.phase = 'targetcomputed';

        return;
    }

    if (context.phase === 'targetcomputed') {
        context.target = state.accumulator.value;
        state.executionStack.push(initialContext(context.node.index));

        context.phase = 'indexcomputed';

        return;
    }

    if (context.phase === 'indexcomputed') {
        // todo

        return;
    }
}

// Execute Expression Statement - expression đứng một mình: print(x); x + 1;
// init: push inner expression vào executionStack để tính
// done: expression đã xong, kết quả bị bỏ qua vì statement không return value → pop
export function executeExpressionStatement(context: ExpressionStatementContext, state: State) {
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

// Execute Call - gọi function hoặc method và đưa argument vào: add(1, 2), print(x), obj.method(a, b)
export function executeCall(context: CallContext, state: State) {
    // init: bắt đầu bằng việc tính target expression (add, obj.method, arr[0]...)
    // Chưa biết đây là function gì cho đến khi target được evaluate xong
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.target));
        context.phase = 'targetcomputed';

        return;
    }

    // targetcomputed: accumulator.value là Pointer đến FunctionValue, lưu lại vào context.target trước khi accumulator bị ghi đè bởi args
    // Nếu có arguments → bắt đầu tính arg đầu tiên
    // Không có arguments → nhảy thẳng sang callready
    if (context.phase === 'targetcomputed') {
        context.target = state.accumulator.value;

        if (context.node.arguments.length > 0) {
            state.executionStack.push(initialContext(context.node.arguments[0]));
            context.phase = 'argcomputed';
        } else context.phase = 'callready';

        return;
    }

    // argcomputed: mỗi lần một argument vừa được tính xong, push Pointer vào context.args để accumulate
    // Nếu còn arguments chưa tính → push argument tiếp theo (index = context.args.length sau khi push)
    // Đã tính hết tất cả → sang callready
    if (context.phase === 'argcomputed') {
        context.args.push(state.accumulator.value);

        if (context.args.length < context.node.arguments.length) {
            state.executionStack.push(initialContext(context.node.arguments[context.args.length]));
            return;
        } else context.phase = 'callready';

        return;
    }

    // callready: có đủ target + tất cả args → sẵn sàng gọi function
    // builtinfunction: gọi impl() trực tiếp, lấy kết quả ngay, pop luôn (không có body để execute)
    // function: tạo LexicalEnvironment mới với parent = parentEnvironment của function (closure!)
    //           bind từng param với arg tương ứng, nếu thiếu arg thì bind null
    //           push frame mới vào callStack, push body Block vào executionStack
    //           chuyển phase → done để dọn dẹp sau khi body xong
    if (context.phase === 'callready') {
        // Lấy lại function value đã lưu từ trước đó
        const fnValue = state.heap.get(context.target!);

        // Builtin không có AST body - gọi JS function trực tiếp và xong
        if (fnValue.type === 'builtinfunction') {
            state.accumulator.value = fnValue.impl(context.args);
            state.executionStack.pop();
        } else if (fnValue.type === 'function') {
            // Tạo scope mới cho lần gọi này - parent là scope nơi function được định nghĩa
            const newEnvironment = new LexicalEnvironment(fnValue.parentEnvironment);

            // Bind params → args theo thứ tự, thiếu arg thì dùng null
            fnValue.node.parameters.forEach((param, index) => {
                newEnvironment.set(param.name, context.args[index] ?? state.heap.set({ type: 'null' }));
            });

            state.callStack.push(fnValue.node.name, fnValue.node.body, newEnvironment);
            state.executionStack.push(initialContext(fnValue.node.body));

            context.phase = 'done';
        } else {
            throw new Error(`Target is not a function: ${fnValue.type}`);
        }

        return;
    }

    // done: body của function đã execute xong
    // nếu có return statement → accumulator.isReturn = true, accumulator.value = return value
    //   → reset isReturn về false (return đã được handled tại đây)
    //   → accumulator.value giữ nguyên để caller đọc
    // nếu không có return statement → function return null ngầm định
    // pop callStack frame và pop context khỏi executionStack
    if (context.phase === 'done') {
        state.callStack.pop();

        if (state.accumulator.isReturn) {
            state.accumulator.isReturn = false;
        } else {
            state.accumulator.value = state.heap.set({ type: 'null' });
        }

        state.executionStack.pop();

        return;
    }
}

// Execute If Statement - if (condition) { body } else if (...) { } else { }
// init:         push condition expression vào executionStack
// condcomputed: condition xong → đọc accumulator.value từ Heap
//               isTruthy → push body Block, chuyển phase done
//               không truthy + có elseIf → pop, push ElseIfContext bắt đầu từ index 0
//               không truthy + có else branch → pop, push else Block
//               không truthy + không có gì → bỏ qua
// done:         pop
export function executeIfStatement(context: IfStatementContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.condition));
        context.phase = 'condcomputed';

        return;
    }

    if (context.phase === 'condcomputed') {
        if (isTruthy(state.heap.get(state.accumulator.value))) {
            state.executionStack.push(initialContext(context.node.body));
            context.phase = 'done';
        } else {
            state.executionStack.pop();

            if (context.node.elseIf.length > 0) {
                state.executionStack.push(initialElseIfContext(context.node, 0));
            } else if (context.node.else) {
                state.executionStack.push(initialContext(context.node.else));
            }
        }

        return;
    }

    if (context.phase === 'done') {
        state.executionStack.pop();
        return;
    }
}

// Execute ElseIf Branch - dùng index để biết đang xử lý elseIf[index]
// init:         push condition của elseIf[index] vào executionStack
// condcomputed: condition xong →
//               isTruthy → push body Block, chuyển phase done
//               còn elseIf tiếp → pop, push ElseIfContext với index + 1 (đệ quy qua chain)
//               có else branch → pop, push else Block
//               không có gì → bỏ qua
// done:         pop
export function executeElseIf(context: ElseIfContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.elseIf[context.index].condition));
        context.phase = 'condcomputed';

        return;
    }

    if (context.phase === 'condcomputed') {
        if (isTruthy(state.heap.get(state.accumulator.value))) {
            state.executionStack.push(initialContext(context.node.elseIf[context.index].body));
            context.phase = 'done';
        } else {
            state.executionStack.pop();

            if (context.index + 1 < context.node.elseIf.length) {
                state.executionStack.push(initialElseIfContext(context.node, context.index + 1));
            } else if (context.node.else) {
                state.executionStack.push(initialContext(context.node.else));
            }
        }

        return;
    }

    if (context.phase === 'done') {
        state.executionStack.pop();
        return;
    }
}

// Execute While Loop - while (condition) { body }
// Vòng lặp được tạo ra bằng cách reset phase về 'init' sau mỗi iteration
// init:         push condition expression vào executionStack
// condcomputed: condition xong → đọc accumulator.value từ Heap → isTruthy?
//               true  → push body Block, reset phase về 'init' để tính lại condition sau
//               false → pop, kết thúc vòng lặp
export function executeWhileLoop(context: WhileLoopContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.condition));
        context.phase = 'condcomputed';

        return;
    }

    if (context.phase === 'condcomputed') {
        // heap.get() để đưa Pointer về RuntimeValue trước khi check truthy
        if (isTruthy(state.heap.get(state.accumulator.value))) {
            state.executionStack.push(initialContext(context.node.body));
            context.phase = 'init';
        } else {
            state.executionStack.pop();
        }

        return;
    }
}

// Execute Function Declaration
// Tạo fnPointer lưu AST node + parentEnvironment (scope hiện tại) để support closure
// Closure hoạt động vì khi hàm được gọi sau này, nó dùng parentEnvironment để lookup biến từ scope nơi nó được định nghĩa, không phải nơi nó được gọi
// Set fnPointer vào LexicalEnvironment theo tên hàm → pop
export function executeFunctionDeclaration(context: FunctionDeclarationContext, state: State) {
    const fnPointer = state.heap.set({
        type: 'function',
        node: context.node,
        parentEnvironment: state.callStack.peek().environment,
    });

    state.callStack.peek().environment.set(context.node.name, fnPointer);
    state.executionStack.pop();

    return;
}

// Execute Return Statement - có thể có hoặc không có Expression
// init: có expression → push vào executionStack để tính, chuyển phase → done
//       không có expression → set accumulator.value = null
// done: expression đã xong, accumulator.value có kết quả
//       set isReturn = true → tất cả BlockContext trên đường về sẽ pop ngay
//       cho đến khi CallContext bắt được và reset isReturn = false
export function executeReturnStatement(context: ReturnStatementContext, state: State) {
    if (context.phase === 'init') {
        if (context.node.expression) {
            state.executionStack.push(initialContext(context.node.expression));
        } else {
            state.accumulator.value = state.heap.set({ type: 'null' });
        }

        context.phase = 'done';

        return;
    }

    if (context.phase === 'done') {
        state.accumulator.isReturn = true;
        state.executionStack.pop();

        return;
    }
}

export function execute(context: Context, state: State) {
    // Khi isReturn = true, tất cả contexts trên đường về đều bị pop, chỉ CallContext mới được xử lý bình thường
    if (state.accumulator.isReturn && context.type !== 'Call') {
        state.executionStack.pop();
        return;
    }

    switch (context.type) {
        case 'Block':
            return executeBlock(context, state);
        case 'Primitive':
            return executePrimitive(context, state);
        case 'ParenthesizedExpression':
            return executeParenthesizedExpression(context, state);
        case 'BinaryExpression':
            return executeBinaryExpression(context, state);
        case 'UnaryExpression':
            return executeUnaryExpression(context, state);
        case 'PropAccess':
            return executePropAccess(context, state);
        case 'ElementAccess':
            return executeElementAccess(context, state);
        case 'ExpressionStatement':
            return executeExpressionStatement(context, state);
        case 'Call':
            return executeCall(context, state);
        case 'IfStatement':
            return executeIfStatement(context, state);
        case 'ElseIf':
            return executeElseIf(context, state);
        case 'WhileLoop':
            return executeWhileLoop(context, state);
        case 'FunctionDeclaration':
            return executeFunctionDeclaration(context, state);
        case 'ReturnStatement':
            return executeReturnStatement(context, state);
    }
}
