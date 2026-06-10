import type { ASTNode, ElementAccess, Identifier, IfStatement, PropAccess } from '../frontend/ast';
import type {
    Accumulator,
    ArrayLiteralContext,
    BinaryExpressionContext,
    BlockContext,
    CallContext,
    Context,
    ElementAccessAssignmentContext,
    ElementAccessContext,
    ElseIfContext,
    ExpressionStatementContext,
    FunctionDeclarationContext,
    IdentifierAssignmentContext,
    IfStatementContext,
    ObjectLiteralContext,
    ParenthesizedExpressionContext,
    PrimitiveContext,
    PropAccessAssignmentContext,
    PropAccessContext,
    ReturnStatementContext,
    UnaryExpressionContext,
    WhileLoopContext,
} from './context';
import {
    CallStack,
    coerceString,
    Heap,
    isPrimitive,
    isPrimitiveEqual,
    isTruthy,
    LexicalEnvironment,
    type Pointer,
} from './memory';

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
        case 'ArrayLiteral':
            return { type: 'ArrayLiteral', node: node, phase: 'init', elements: [] };
        case 'ObjectLiteral':
            return { type: 'ObjectLiteral', node: node, phase: 'init', pairs: [] };
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
        case 'AssignmentStatement':
            if (node.left.type === 'Identifier') return { type: 'IdentifierAssignment', node: node, phase: 'init' };
            if (node.left.type === 'PropAccess') return { type: 'PropAccessAssignment', node: node, phase: 'init' };
            if (node.left.type === 'ElementAccess')
                return { type: 'ElementAccessAssignment', node: node, phase: 'init' };

        default:
            throw new Error(`Unknown node type: ${node.type}`);
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
function executePrimitive(context: PrimitiveContext, state: State) {
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

// Execute Expression được bọc trong (): (x + 1) * 2
// Dấu ngoặc chỉ dùng để nhóm, không tạo ra value mới - chỉ cần execute expression bên trong
// init: push inner expression vào executionStack
// done: accumulator.value đã có kết quả → pop
function executeParenthesizedExpression(context: ParenthesizedExpressionContext, state: State) {
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

// Execute Array Literal: [1, 2 + 3, fn()]
// init:             Nếu mảng rỗng → chuyển thẳng sang done. Nếu không → push element đầu tiên vào executionStack
// elementscomputed: Mỗi khi một element được tính xong → lưu Pointer vào context.elements
//                   Nếu còn element tiếp theo → push vào executionStack
//                   Nếu đã hết element → chuyển sang done
// done:             Tạo ArrayValue trên Heap từ các elements đã thu thập, ghi Pointer vào accumulator.value → pop
function executeArrayLiteral(context: ArrayLiteralContext, state: State) {
    if (context.phase === 'init') {
        if (context.node.elements.length > 0) {
            state.executionStack.push(initialContext(context.node.elements[0]));
            context.phase = 'elementscomputed';
        } else {
            context.phase = 'done';
        }

        return;
    }

    if (context.phase === 'elementscomputed') {
        context.elements.push(state.accumulator.value);

        if (context.elements.length < context.node.elements.length) {
            state.executionStack.push(initialContext(context.node.elements[context.elements.length]));
        } else {
            context.phase = 'done';
        }

        return;
    }

    if (context.phase === 'done') {
        state.accumulator.value = state.heap.set({ type: 'array', elements: context.elements });
        state.executionStack.pop();

        return;
    }
}

// Execute Object Literal: { name: "John", [x + 1]: 42 }
// init:          Nếu object rỗng → chuyển sang done. Nếu không → xử lý cặp đầu tiên
//                Nếu là ExpressionKey ([x]) → push expression để tính key → keycomputed
//                Nếu là IdentifierKey (name) → lấy tên trực tiếp, push value expression → valuecomputed
// keycomputed:   Lấy kết quả key từ accumulator (đã tính xong), ép kiểu sang string
//                Tiếp tục push value expression của cặp hiện tại vào stack → valuecomputed
// valuecomputed: Thu thập kết quả value vừa xong vào context.pairs
//                Nếu còn cặp tiếp theo → lặp lại logic xử lý Key tương tự phase init
//                Nếu đã hết → chuyển sang done
// done:          Tạo ObjectValue trên Heap từ context.pairs, ghi Pointer vào accumulator.value → pop
function executeObjectLiteral(context: ObjectLiteralContext, state: State) {
    if (context.phase === 'init') {
        if (context.node.pairs.length > 0) {
            // pairs[0] là cặp key-value đầu tiên. Index [0] bên trong lấy node Key.
            const key = context.node.pairs[0][0];

            if (key.type === 'ExpressionKey') {
                state.executionStack.push(initialContext(key.expression));
                context.phase = 'keycomputed';
            } else {
                // IdentifierKey: dùng tên trực tiếp làm key, không evaluate identifier như một biến
                context.key = key.identifier.name;
                // Index [1] lấy node Value expression của cặp đầu tiên.
                state.executionStack.push(initialContext(context.node.pairs[0][1]));
                context.phase = 'valuecomputed';
            }
        } else {
            context.phase = 'done';
        }

        return;
    }

    if (context.phase === 'keycomputed') {
        const key = state.heap.get(state.accumulator.value);

        if (!isPrimitive(key)) {
            throw new Error(`Object key must be a primitive, but got ${key.type}`);
        }

        context.key = key.type === 'string' ? key.value : coerceString(key);
        // pairs.length đóng vai trò là index của cặp hiện tại đang xử lý.
        // Index [1] lấy phần Value của cặp đó.
        state.executionStack.push(initialContext(context.node.pairs[context.pairs.length][1]));
        context.phase = 'valuecomputed';

        return;
    }

    if (context.phase === 'valuecomputed') {
        const valuePointer = state.accumulator.value;
        context.pairs.push([context.key!, valuePointer]);

        if (context.pairs.length < context.node.pairs.length) {
            // context.pairs.length lúc này là index của cặp tiếp theo trong AST.
            // Index [0] lấy node Key của cặp tiếp theo đó.
            const key = context.node.pairs[context.pairs.length][0];

            if (key.type === 'ExpressionKey') {
                state.executionStack.push(initialContext(key.expression));
                context.phase = 'keycomputed';
            } else {
                // IdentifierKey cho các cặp tiếp theo
                context.key = key.identifier.name;
                // Index [1] lấy node Value của cặp tiếp theo.
                state.executionStack.push(initialContext(context.node.pairs[context.pairs.length][1]));
                context.phase = 'valuecomputed';
            }
        } else {
            context.phase = 'done';
        }

        return;
    }

    if (context.phase === 'done') {
        // Object.fromEntries chuyển mảng các cặp [key, Pointer] thành object { key: Pointer }.
        // Ví dụ: [['a', 'ptr-1'], ['b', 'ptr-2']] => { a: 'ptr-1', b: 'ptr-2' }.
        const properties = Object.fromEntries(context.pairs);
        state.accumulator.value = state.heap.set({ type: 'object', properties });
        state.executionStack.pop();

        return;
    }
}

// Execute Binary Expression
// init:        push left expression vào executionStack
// lhscomputed: Lưu accumulator.value vào context.left, push right expression
//              Short-circuit: && với left=false hoặc || với left=true → pop ngay, không tính right
// rhscomputed: Có đủ left + accumulator.value (right) → apply operator → ghi kết quả → pop
function executeBinaryExpression(context: BinaryExpressionContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.left));
        context.phase = 'lhscomputed';

        return;
    }

    if (context.phase === 'lhscomputed') {
        context.left = state.accumulator.value;
        const leftValue = state.heap.get(context.left);

        // Nếu left false thì không cần tính right
        if (context.node.operator === '&&' && !isTruthy(leftValue)) {
            state.accumulator.value = state.heap.set({ type: 'boolean', value: false });
            state.executionStack.pop();
            return;
        }

        // Nếu left true thì không cần tính right
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
        const leftPointer = context.left!;
        const rightPointer = state.accumulator.value;
        const leftValue = state.heap.get(leftPointer);
        const rightValue = state.heap.get(rightPointer);

        let result: Pointer;

        switch (context.node.operator) {
            case '+':
                if (leftValue.type === 'number' && rightValue.type === 'number') {
                    result = state.heap.set({ type: 'number', value: leftValue.value + rightValue.value });
                } else if (leftValue.type === 'string' && rightValue.type === 'string') {
                    result = state.heap.set({ type: 'string', value: leftValue.value + rightValue.value });
                } else throw new Error(`Invalid operands for +: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '-':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'number', value: leftValue.value - rightValue.value });
                else throw new Error(`Invalid operands for -: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '*':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'number', value: leftValue.value * rightValue.value });
                else throw new Error(`Invalid operands for *: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '/':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'number', value: leftValue.value / rightValue.value });
                else throw new Error(`Invalid operands for /: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '%':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'number', value: leftValue.value % rightValue.value });
                else throw new Error(`Invalid operands for %: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '>':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'boolean', value: leftValue.value > rightValue.value });
                else throw new Error(`Invalid operands for >: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '<':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'boolean', value: leftValue.value < rightValue.value });
                else throw new Error(`Invalid operands for <: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '>=':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'boolean', value: leftValue.value >= rightValue.value });
                else throw new Error(`Invalid operands for >=: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '<=':
                if (leftValue.type === 'number' && rightValue.type === 'number')
                    result = state.heap.set({ type: 'boolean', value: leftValue.value <= rightValue.value });
                else throw new Error(`Invalid operands for <=: ${leftValue.type} and ${rightValue.type}`);
                break;
            case '==':
                if (leftPointer === rightPointer) result = state.heap.set({ type: 'boolean', value: true });
                else if (isPrimitive(leftValue) && isPrimitive(rightValue))
                    result = state.heap.set({ type: 'boolean', value: isPrimitiveEqual(leftValue, rightValue) });
                else result = state.heap.set({ type: 'boolean', value: false });
                break;
            case '!=':
                if (leftPointer === rightPointer) result = state.heap.set({ type: 'boolean', value: false });
                else if (isPrimitive(leftValue) && isPrimitive(rightValue))
                    result = state.heap.set({ type: 'boolean', value: !isPrimitiveEqual(leftValue, rightValue) });
                else result = state.heap.set({ type: 'boolean', value: true });
                break;
            case '&&':
                result = state.heap.set({ type: 'boolean', value: isTruthy(leftValue) && isTruthy(rightValue) });
                break;
            case '||':
                result = state.heap.set({ type: 'boolean', value: isTruthy(leftValue) || isTruthy(rightValue) });
                break;
        }

        state.accumulator.value = result;
        state.executionStack.pop();

        return;
    }
}

// Execute Unary Expression: !true, -x, +1
// init:        push argument expression vào executionStack
// argcomputed: Apply operator lên value → ghi kết quả vào accumulator.value → pop
function executeUnaryExpression(context: UnaryExpressionContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.argument));
        context.phase = 'argcomputed';

        return;
    }

    if (context.phase === 'argcomputed') {
        const value = state.heap.get(state.accumulator.value);

        switch (context.node.operator) {
            case '!':
                state.accumulator.value = state.heap.set({ type: 'boolean', value: !isTruthy(value) });
                break;
            case '+':
                if (value.type !== 'number') throw new Error(`Unary '+' expects number, got ${value.type}`);
                // Pointer hiện tại trong accumulator.value chính là kết quả, không cần set mới vào heap
                // state.accumulator.value = state.heap.set({ type: 'number', value: value.value });
                break;
            case '-':
                if (value.type !== 'number') throw new Error(`Unary '-' expects number, got ${value.type}`);
                state.accumulator.value = state.heap.set({ type: 'number', value: -value.value });
                break;
        }

        state.executionStack.pop();

        return;
    }
}

// Execute Property Access: obj.property
// init:           push target expression vào executionStack
// targetcomputed: target xong → check phải là object → lookup property name
//                 Property không tồn tại → trả về null thay vì throw
function executePropAccess(context: PropAccessContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.target));
        context.phase = 'targetcomputed';

        return;
    }

    if (context.phase === 'targetcomputed') {
        const targetValue = state.heap.get(state.accumulator.value);

        if (targetValue.type !== 'object') {
            throw new Error(`Cannot access property '${context.node.property.name}' of ${targetValue.type}`);
        }

        // Cho phép check obj.prop === null
        const propertyPointer = targetValue.properties[context.node.property.name];
        state.accumulator.value = propertyPointer ?? state.heap.set({ type: 'null' });
        state.executionStack.pop();

        return;
    }
}

// Execute Element Access: arr[0], matrix[r][c], obj["key"]
// init:           push target vào executionStack
// targetcomputed: Lưu accumulator.value vào context.target, push index expression
// indexcomputed:  target + index → lookup element
//                 array: index phải là number, out of bounds → throw
//                 object: index là primitive, coerce sang string làm key
function executeElementAccess(context: ElementAccessContext, state: State) {
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
        const targetValue = state.heap.get(context.target!);
        const indexValue = state.heap.get(state.accumulator.value);

        if (targetValue.type === 'array') {
            if (indexValue.type !== 'number') {
                throw new Error(`Array index must be a number, but got ${indexValue.type}`);
            }

            // Out of bounds → null, không throw
            const element = targetValue.elements[indexValue.value];
            state.accumulator.value = element ?? state.heap.set({ type: 'null' });
        } else if (targetValue.type === 'object') {
            if (!isPrimitive(indexValue)) {
                throw new Error(`Object property key must be a primitive, but got ${indexValue.type}`);
            }

            // coerceString chuyển number/boolean/null sang string để dùng làm key
            const property = targetValue.properties[coerceString(indexValue)];
            state.accumulator.value = property ?? state.heap.set({ type: 'null' });
        } else {
            throw new Error(`Cannot access element of ${targetValue.type}`);
        }

        state.executionStack.pop();

        return;
    }
}

// Execute Call - gọi function hoặc method và đưa argument vào: add(1, 2), print(x), obj.method(a, b)
function executeCall(context: CallContext, state: State) {
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
function executeIfStatement(context: IfStatementContext, state: State) {
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
            // pop() body block
            state.executionStack.pop();

            if (context.node.elseIfs.length > 0) {
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

// Execute ElseIf Branch - dùng index để biết đang xử lý elseIfs[index]
// init:         push condition của elseIfs[index] vào executionStack
// condcomputed: condition xong →
//               isTruthy → push body Block, chuyển phase done
//               còn elseIf tiếp → pop, push ElseIfContext với index + 1 (đệ quy qua chain)
//               có else branch → pop, push else Block
//               không có gì → bỏ qua
// done:         pop
function executeElseIf(context: ElseIfContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.elseIfs[context.index].condition));
        context.phase = 'condcomputed';

        return;
    }

    if (context.phase === 'condcomputed') {
        if (isTruthy(state.heap.get(state.accumulator.value))) {
            state.executionStack.push(initialContext(context.node.elseIfs[context.index].body));
            context.phase = 'done';
        } else {
            state.executionStack.pop();

            if (context.index + 1 < context.node.elseIfs.length) {
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
function executeWhileLoop(context: WhileLoopContext, state: State) {
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
function executeFunctionDeclaration(context: FunctionDeclarationContext, state: State) {
    // Tạo một vùng nhớ trên Heap để lưu trữ thông tin hàm
    const fnPointer = state.heap.set({
        type: 'function',
        node: context.node, // Lưu lại AST node để biết code bên trong hàm có gì
        parentEnvironment: state.callStack.peek().environment, // Chụp lại scope hiện tại (Lexical Scoping)
    });

    // Đưa tên hàm vào scope hiện tại để các câu lệnh sau có thể gọi được
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
function executeReturnStatement(context: ReturnStatementContext, state: State) {
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

// Execute Identifier Assignment: x = 42
// init:        push right expression vào executionStack để tính value
// rhscomputed: accumulator.value là kết quả right
//              Cast left sang Identifier để lấy tên biến
//              Set Pointer vào LexicalEnvironment của frame hiện tại → pop
function executeIdentifierAssignment(context: IdentifierAssignmentContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.right));
        context.phase = 'rhscomputed';

        return;
    }

    if (context.phase === 'rhscomputed') {
        const valuePointer = state.accumulator.value;
        const valueName = (context.node.left as Identifier).name;
        const environment = state.callStack.peek().environment;

        // Thử cập nhật biến ở scope gần nhất đã khai báo nó (Lexical Scoping).
        // Nếu không tìm thấy trong toàn bộ scope chain, mới khởi tạo ở local scope.
        if (!environment.update(valueName, valuePointer)) {
            environment.set(valueName, valuePointer);
        }

        state.executionStack.pop();

        return;
    }
}

// Execute Property Access Assignment: obj.name = value
// init:           push right expression vào executionStack
// rhscomputed:    Lưu kết quả vế phải vào context.right để tránh bị ghi đè
//                 push target expression (phần bên trái dấu .) vào stack
// targetcomputed: Sau khi có Pointer của đối tượng đích, kiểm tra xem nó có phải là 'object' không
//                 Nếu đúng, cập nhật thuộc tính tương ứng trong Heap bằng Pointer context.right đã lưu
function executePropAccessAssignment(context: PropAccessAssignmentContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.right));
        context.phase = 'rhscomputed';

        return;
    }

    if (context.phase === 'rhscomputed') {
        // Lưu tạm right trước khi accumulator bị ghi đè khi tính target
        context.right = state.accumulator.value;
        state.executionStack.push(initialContext((context.node.left as PropAccess).target));
        context.phase = 'targetcomputed';

        return;
    }

    if (context.phase === 'targetcomputed') {
        const targetValue = state.heap.get(state.accumulator.value);

        if (targetValue.type !== 'object') {
            throw new Error(`Cannot assign to property of ${targetValue.type}`);
        }

        // Mutate object trực tiếp trên Heap, tất cả Pointers trỏ vào object này đều thấy thay đổi
        targetValue.properties[(context.node.left as PropAccess).property.name] = context.right!;
        state.executionStack.pop();

        return;
    }
}

// Execute Element Access Assignment: arr[0] = value, obj["key"] = value
// init:           push right expression
// rhscomputed:    Lưu kết quả vế phải vào context.right, sau đó push target expression
// targetcomputed: Lưu Pointer của target vào context.target, sau đó push index expression
// indexcomputed:  Có đủ 3 thành phần: target, index và giá trị mới (right)
//                 array: index phải là number và trong bounds rồi cập nhật
//                 object: Ép kiểu index sang string để làm key rồi cập nhật property trong Heap
function executeElementAccessAssignment(context: ElementAccessAssignmentContext, state: State) {
    if (context.phase === 'init') {
        state.executionStack.push(initialContext(context.node.right));
        context.phase = 'rhscomputed';

        return;
    }

    if (context.phase === 'rhscomputed') {
        context.right = state.accumulator.value;
        state.executionStack.push(initialContext((context.node.left as ElementAccess).target));
        context.phase = 'targetcomputed';

        return;
    }

    if (context.phase === 'targetcomputed') {
        context.target = state.accumulator.value;
        state.executionStack.push(initialContext((context.node.left as ElementAccess).index));
        context.phase = 'indexcomputed';

        return;
    }

    if (context.phase === 'indexcomputed') {
        const targetValue = state.heap.get(context.target!);
        const indexValue = state.heap.get(state.accumulator.value);

        if (targetValue.type === 'array') {
            if (indexValue.type !== 'number') {
                throw new Error(`Array index must be a number, but got ${indexValue.type}`);
            }

            if (indexValue.value < 0 || indexValue.value >= targetValue.elements.length) {
                throw new Error(`Array index out of bounds: ${indexValue.value}`);
            }

            targetValue.elements[indexValue.value] = context.right!;
        } else if (targetValue.type === 'object') {
            if (!isPrimitive(indexValue)) {
                throw new Error(`Object property key must be a primitive, but got ${indexValue.type}`);
            }

            targetValue.properties[coerceString(indexValue)] = context.right!;
        } else {
            throw new Error(`Cannot assign to element of ${targetValue.type}`);
        }

        state.executionStack.pop();

        return;
    }
}

// Execute Expression Statement - expression đứng một mình: print(x); x + 1;
// init: push inner expression vào executionStack để tính
// done: expression đã xong, kết quả bị bỏ qua vì statement không return value → pop
function executeExpressionStatement(context: ExpressionStatementContext, state: State) {
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
        case 'ArrayLiteral':
            return executeArrayLiteral(context, state);
        case 'ObjectLiteral':
            return executeObjectLiteral(context, state);
        case 'BinaryExpression':
            return executeBinaryExpression(context, state);
        case 'UnaryExpression':
            return executeUnaryExpression(context, state);
        case 'PropAccess':
            return executePropAccess(context, state);
        case 'ElementAccess':
            return executeElementAccess(context, state);
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
        case 'IdentifierAssignment':
            return executeIdentifierAssignment(context, state);
        case 'PropAccessAssignment':
            return executePropAccessAssignment(context, state);
        case 'ElementAccessAssignment':
            return executeElementAccessAssignment(context, state);
        case 'ExpressionStatement':
            return executeExpressionStatement(context, state);
    }
}
