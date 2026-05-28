// Định nghĩa tất cả các node types Parser sẽ tạo và Interpreter sẽ walk qua
import { type TokenLocation } from './tokenizer';

export type ASTNodeId = string;
// Mọi node trong AST đều có id (để Interpreter track) và location (để Visualizer highlight)
interface BaseNode {
    id: ASTNodeId;
    location: TokenLocation;
}

// Phần thân { ... } của if, while, fn - chứa danh sách các Statements
export interface Block extends BaseNode {
    type: 'Block';
    statements: Statement[];
}

export interface NumberLiteral extends BaseNode {
    type: 'NumberLiteral';
    value: number;
}

export interface StringLiteral extends BaseNode {
    type: 'StringLiteral';
    value: string;
}

export interface BooleanLiteral extends BaseNode {
    type: 'BooleanLiteral';
    value: boolean;
}

export interface NullLiteral extends BaseNode {
    type: 'NullLiteral';
}

// Tên biến hoặc function do người dùng đặt - x, myVar, add
export interface Identifier extends BaseNode {
    type: 'Identifier';
    name: string;
}

// Primitive - giá trị đơn, không thể chia nhỏ hơn
export type Primitive = NumberLiteral | StringLiteral | BooleanLiteral | NullLiteral | Identifier;

// Expression được bọc trong () để nhóm - ví dụ: (x + 1) * 2
export interface ParenthesizedExpression extends BaseNode {
    type: 'ParenthesizedExpression';
    expressions: Expression;
}

// Danh sách các elements bên trong [1, "hello", fn(x)] - mỗi element là một Expression bất kỳ
export interface ArrayLiteral extends BaseNode {
    type: 'ArrayLiteral';
    elements: Expression[];
}

// Key của object literal có 2 dạng:
//   { name: "John" }    → IdentifierKey (tên trực tiếp, không evaluate)
//   { [x + 1]: "value" }  → ExpressionKey (tính toán trước khi dùng làm key)
export interface IdentifierKey {
    type: 'IdentifierKey';
    identifier: Identifier;
}

export interface ExpressionKey {
    type: 'ExpressionKey';
    expression: Expression;
}

type Key = IdentifierKey | ExpressionKey;
export type KVPair = [Key, Expression]; // Cặp [key, value]
// ObjectLiteral là danh sách các cặp [key, value]
export interface ObjectLiteral extends BaseNode {
    type: 'ObjectLiteral';
    pairs: KVPair[];
}

// Atom là Expression đơn giản nhất, Parser đọc trực tiếp, gồm Primitive + các dạng bọc (Expression), [Array], {Object}
//   (1 + 2)   → ParenthesizedExpression
//   [1, 2]    → ArrayLiteral
//   { a: 1 }  → ObjectLiteral
export type Atom = Primitive | ParenthesizedExpression | ArrayLiteral | ObjectLiteral;

// x + 1, a == b, x > 0, arr && isValid
export interface BinaryExpression extends BaseNode {
    type: 'BinaryExpression';
    left: Expression;
    operator: '+' | '-' | '*' | '/' | '%' | '>' | '<' | '>=' | '<=' | '==' | '!=' | '&&' | '||';
    right: Expression;
}

// !true, -x, +1
export interface UnaryExpression extends BaseNode {
    type: 'UnaryExpression';
    operator: '!' | '-' | '+';
    argument: Expression;
}

// obj.name, person.address.city - truy cập property qua dấu .
export interface PropAccess extends BaseNode {
    type: 'PropAccess';
    target: Expression; // Expression bên trái dấu .
    property: Identifier; // Identifier bên phải dấu .
}

// arr[0], matrix[r][c] - truy cập phần tử qua index
export interface ElementAccess extends BaseNode {
    type: 'ElementAccess';
    target: Expression; // Expression bên trái [
    index: Expression; // Expression bên trong []
}

// add(1, 2), print(x), obj.method(a, b) - gọi function hoặc method và đưa argument vào
export interface Call extends BaseNode {
    type: 'Call';
    target: Expression; // Expression bị gọi (có thể là identifier, prop access, element access)
    arguments: Expression[]; // Giá trị truyền vào
}

type AccessOrCall = PropAccess | ElementAccess | Call;

// Expression là bất cứ thứ gì trả về một giá trị khi được tính toán
// Nếu có thể viết: let x = <thứ này> - đó là Expression
// Dùng ở nhiều chỗ: sau '=', trong condition của if/while, trong argument list...
export type Expression = Atom | AccessOrCall | BinaryExpression | UnaryExpression;

// if (condition) { body } else if (elseIfCondition) { elseIfBody } else { elseBranch }
export interface IfStatement extends BaseNode {
    type: 'IfStatement';
    condition: Expression;
    body: Block;
    elseIf: ElseIf[]; // danh sách các else if branch
    else?: Block; // optional - không phải lúc nào cũng có else
}

export interface ElseIf {
    condition: Expression;
    body: Block;
}

// while (condition) { body }
export interface WhileLoop extends BaseNode {
    type: 'WhileLoop';
    condition: Expression;
    body: Block;
}

// fn add(a, b) { body } - add là function name identifier và a, b là parameter identifiers
export interface FunctionDeclaration extends BaseNode {
    type: 'FunctionDeclaration';
    name: string;
    parameters: Identifier[];
    body: Block;
}

// return; hoặc return x + 1; - Expression là optional vì có thể return không có giá trị
export interface ReturnStatement extends BaseNode {
    type: 'ReturnStatement';
    expression?: Expression;
}

// Phép gán, chỉ có 1 operator là dấu =
export interface AssignmentStatement extends BaseNode {
    type: 'AssignmentStatement';
    left: Expression;
    right: Expression;
}

// ExpressionStatement là khi một Expression đứng 1 mình thành câu lệnh, kết thúc bằng ;
// print(x);   đây là ExpressionStatement, bên trong có Call Expression
// x + 1;      hợp lệ nhưng vô nghĩa, vẫn là ExpressionStatement
export interface ExpressionStatement extends BaseNode {
    type: 'ExpressionStatement';
    expression: Expression;
}

// Statement là một câu lệnh hoàn chỉnh - nó làm một việc gì đó nhưng không trả về giá trị
// Nếu ko thể viết: let x = <thứ này> - đó là Statement
// prettier-ignore
export type Statement = IfStatement | WhileLoop | FunctionDeclaration | ReturnStatement | AssignmentStatement | ExpressionStatement;

export type ASTNode = Block | Statement | Expression;
