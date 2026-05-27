import type {
    ArrayLiteral,
    AssignmentStatement,
    BinaryExpression,
    Block,
    Call,
    ElementAccess,
    ExpressionStatement,
    FunctionDeclaration,
    IfStatement,
    ObjectLiteral,
    ParenthesizedExpression,
    Primitive,
    PropAccess,
    ReturnStatement,
    UnaryExpression,
    WhileLoop,
} from '../frontend/ast';
import { type Pointer } from './memory';

// Mọi Context đều có field này, tránh pause vô hạn tại cùng một breakpoint
interface BaseContext {
    breakpoint?: boolean;
}

// Kênh truyền kết quả từ child context lên parent context
export interface Accumulator {
    value: Pointer; // // Kết quả của expression/statement vừa xong
    isReturn: boolean; // true khi đang unwind stack do return, mọi context trên đường về đều bị pop
}

// programCounter là index của Statement tiếp theo cần execute trong block.statements[]
export interface BlockContext extends BaseContext {
    type: 'Block';
    node: Block;
    programCounter: number;
}

export interface PrimitiveContext extends BaseContext {
    type: 'Primitive';
    node: Primitive;
    phase: 'init' | 'done';
}

export interface ParenthesizedExpressionContext extends BaseContext {
    type: 'ParenthesizedExpression';
    node: ParenthesizedExpression;
    phase: 'init' | 'done';
}

export interface ArrayLiteralContext extends BaseContext {
    type: 'ArrayLiteral';
    node: ArrayLiteral;
    phase: 'init' | 'elementscomputed' | 'done';
    elements: Pointer[];
}

export interface ObjectLiteralContext extends BaseContext {
    type: 'ObjectLiteral';
    node: ObjectLiteral;
    phase: 'init' | 'keycomputed' | 'valuecomputed' | 'done';
    key?: string;
    pairs: [string, Pointer][];
}

export interface BinaryExpressionContext extends BaseContext {
    type: 'BinaryExpression';
    node: BinaryExpression;
    phase: 'init' | 'lhscomputed' | 'rhscomputed';
    left?: Pointer;
}

export interface UnaryExpressionContext extends BaseContext {
    type: 'UnaryExpression';
    node: UnaryExpression;
    phase: 'init' | 'argcomputed';
}

export interface PropAccessContext extends BaseContext {
    type: 'PropAccess';
    node: PropAccess;
    phase: 'init' | 'targetcomputed';
}

export interface ElementAccessContext extends BaseContext {
    type: 'ElementAccess';
    node: ElementAccess;
    phase: 'init' | 'targetcomputed' | 'indexcomputed';
    target?: Pointer;
}

export interface CallContext extends BaseContext {
    type: 'Call';
    node: Call;
    phase: 'init' | 'targetcomputed' | 'argcomputed' | 'callready' | 'done';
    target?: Pointer;
    args: Pointer[];
}

export interface IfStatementContext extends BaseContext {
    type: 'IfStatement';
    node: IfStatement;
    phase: 'init' | 'condcomputed' | 'done';
}

export interface ElseIfContext extends BaseContext {
    type: 'ElseIf';
    node: IfStatement;
    phase: 'init' | 'condcomputed' | 'done';
    index: number;
}

export interface WhileLoopContext extends BaseContext {
    type: 'WhileLoop';
    node: WhileLoop;
    phase: 'init' | 'condcomputed';
}

// Chỉ cần declare function vào LexicalEnvironment
export interface FunctionDeclarationContext extends BaseContext {
    type: 'FunctionDeclaration';
    node: FunctionDeclaration;
}

export interface ReturnStatementContext extends BaseContext {
    type: 'ReturnStatement';
    node: ReturnStatement;
    phase: 'init' | 'done';
}

// x = 42, left là Identifier
export interface IdentifierAssignmentContext extends BaseContext {
    type: 'IdentifierAssignment';
    node: AssignmentStatement;
    phase: 'init' | 'rhscomputed';
}

// obj.name = value, left là PropAccess
export interface PropAccessAssignmentContext extends BaseContext {
    type: 'PropAccessAssignment';
    node: AssignmentStatement;
    phase: 'init' | 'rhscomputed' | 'targetcomputed';
    right?: Pointer;
}

// arr[0] = value, left là ElementAccess
export interface ElementAccessAssignmentContext extends BaseContext {
    type: 'ElementAccessAssignment';
    node: AssignmentStatement;
    phase: 'init' | 'rhscomputed' | 'targetcomputed' | 'indexcomputed';
    right?: Pointer;
    target?: Pointer;
}

// print(x); x + 1;
export interface ExpressionStatementContext extends BaseContext {
    type: 'ExpressionStatement';
    node: ExpressionStatement;
    phase: 'init' | 'done';
}

export type Context =
    | BlockContext
    | PrimitiveContext
    | ParenthesizedExpressionContext
    | ArrayLiteralContext
    | ObjectLiteralContext
    | BinaryExpressionContext
    | UnaryExpressionContext
    | PropAccessContext
    | ElementAccessContext
    | CallContext
    | IfStatementContext
    | ElseIfContext
    | WhileLoopContext
    | FunctionDeclarationContext
    | ReturnStatementContext
    | IdentifierAssignmentContext
    | PropAccessAssignmentContext
    | ElementAccessAssignmentContext
    | ExpressionStatementContext;
