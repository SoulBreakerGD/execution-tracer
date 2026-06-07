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

// Kênh truyền pointer từ child context lên parent context
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
    elements: Pointer[]; // Danh sách các Pointer của các phần tử mảng đã được tính toán xong
}

export interface ObjectLiteralContext extends BaseContext {
    type: 'ObjectLiteral';
    node: ObjectLiteral;
    phase: 'init' | 'keycomputed' | 'valuecomputed' | 'done';
    key?: string; // Lưu trữ key đã được tính toán cho cặp hiện tại
    pairs: [string, Pointer][]; // Lưu trữ các cặp key-value đã thu thập
}

export interface BinaryExpressionContext extends BaseContext {
    type: 'BinaryExpression';
    node: BinaryExpression;
    phase: 'init' | 'lhscomputed' | 'rhscomputed';
    left?: Pointer; // left? lưu tạm vì accumulator.value bị ghi đè khi tính right
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
    target?: Pointer; // target? lưu tạm vì accumulator.value bị ghi đè khi tính index
}

export interface CallContext extends BaseContext {
    type: 'Call';
    node: Call;
    phase: 'init' | 'targetcomputed' | 'argcomputed' | 'callready' | 'done';
    target?: Pointer; // Optional vì target ở phase init chưa tồn tại
    args: Pointer[]; // Danh sách các Pointer của các arguments đã tính toán xong
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
    index: number; // Chỉ số của nhánh else if hiện tại đang được xử lý trong mảng elseIf
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
    right?: Pointer; // Lưu kết quả của vế phải (rhs) để dùng sau khi đã xác định được đối tượng đích
}

// arr[0] = value, left là ElementAccess
export interface ElementAccessAssignmentContext extends BaseContext {
    type: 'ElementAccessAssignment';
    node: AssignmentStatement;
    phase: 'init' | 'rhscomputed' | 'targetcomputed' | 'indexcomputed';
    right?: Pointer; // Lưu kết quả của vế phải (rhs)
    target?: Pointer; // Lưu Pointer của mảng/đối tượng đích trong khi chờ tính toán index
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
