// Tokenizer.tokenize() → Token[]
//     ↓
// new TokenManager(tokens)
//     ↓
// new Parser(tokenManager)
import { uuid } from '../utils';
import {
    ArrayLiteral,
    AssignmentStatement,
    Atom,
    Block,
    Expression,
    ExpressionKey,
    ExpressionStatement,
    FunctionDeclaration,
    Identifier,
    IdentifierKey,
    IfStatement,
    KVPair,
    ObjectLiteral,
    ParenthesizedExpression,
    Primitive,
    ReturnStatement,
    Statement,
    WhileLoop,
} from './ast';
import { type IdentifierToken, type Token, TokenManager } from './tokenizer';

// Các Lookahead functions để Parser quyết định token hiện tại parse theo hướng nào trước khi eat() nó
function isPrimitiveLookahead(token: Token): boolean {
    return (
        token.type === 'number' ||
        token.type === 'string' ||
        token.type === 'true' ||
        token.type === 'false' ||
        token.type === 'null' ||
        token.type === 'identifier'
    );
}

function isKVPairLookahead(token: Token): boolean {
    return isPrimitiveLookahead(token) || token.type === '[';
}

function isAtomLookahead(token: Token): boolean {
    return isPrimitiveLookahead(token) || token.type === '(' || token.type === '[' || token.type === '{';
}

function isUnaryExpressionLookahead(token: Token): boolean {
    return token.type === '!' || token.type === '+' || token.type === '-';
}

function isExpressionLookahead(token: Token): boolean {
    return isAtomLookahead(token) || isUnaryExpressionLookahead(token);
}

function isIfStatementLookahead(token: Token): boolean {
    return token.type === 'if';
}

function isWhileLoopLookahead(token: Token): boolean {
    return token.type === 'while';
}

function isFunctionDeclarationLookahead(token: Token): boolean {
    return token.type === 'fn';
}

function isReturnStatementLookahead(token: Token): boolean {
    return token.type === 'return';
}

function isStatementLookahead(token: Token): boolean {
    return (
        isIfStatementLookahead(token) ||
        isWhileLoopLookahead(token) ||
        isFunctionDeclarationLookahead(token) ||
        isReturnStatementLookahead(token) ||
        isExpressionLookahead(token)
    );
}

class Parser {
    private readonly tokenManager: TokenManager;

    constructor(tokenManager: TokenManager) {
        this.tokenManager = tokenManager;
    }

    // Đọc Statements cho đến khi gặp } hoặc EOF
    private parseBlock(): Block {
        const statements: Statement[] = [];
        while (isStatementLookahead(this.tokenManager.peek())) {
            statements.push(this.parseStatement());
        }

        return {
            id: uuid(),
            location:
                statements.length > 0
                    ? { start: statements[0].location.start, end: statements[statements.length - 1].location.end }
                    : this.tokenManager.peek().location,
            type: 'Block',
            statements,
        };
    }

    // Entry point bên ngoài gọi, đọc 1 block chứa tất cả Statements của program (toàn bộ Array token từ đầu đến EOF, return root note của AST)
    // eat('EOF') để đảm bảo đã đọc toàn bộ input
    public parse(): Block {
        const programBlock: Block = this.parseBlock();

        this.tokenManager.eat('EOF');

        return programBlock;
    }

    // parseAtom()                             ← primitive literal, identifier, các dạng bọc (Expression), [Array], {Object}
    //   → parseAccessOrCallExpression()       ← . [] ()
    //     → parseUnaryExpression()            ← ! - +
    //       → parseMultiplicativeExpression() ← * / %
    //         → parseAdditiveExpression()     ← + -
    //           → parseRelationalExpression() ← < > <= >=
    //             → parseEqualityExpression() ← == !=
    //               → parseAndExpression()    ← &&
    //                 → parseOrExpression()   ← ||
    //                   → parseExpression()

    // Parse một giá trị đơn - boolean, null, number, string hoặc identifier
    private parsePrimitive(): Primitive {
        const peekToken = this.tokenManager.peek();

        if (peekToken.type === 'true') {
            this.tokenManager.eat('true');

            // Trả về 1 node Primitive
            return {
                id: uuid(),
                location: peekToken.location,
                type: 'BooleanLiteral',
                value: true,
            };
        }

        if (peekToken.type === 'false') {
            this.tokenManager.eat('false');

            return {
                id: uuid(),
                location: peekToken.location,
                type: 'BooleanLiteral',
                value: false,
            };
        }

        if (peekToken.type === 'null') {
            this.tokenManager.eat('null');

            return {
                id: uuid(),
                location: peekToken.location,
                type: 'NullLiteral',
            };
        }

        if (peekToken.type === 'number') {
            this.tokenManager.eat('number');

            return {
                id: uuid(),
                location: peekToken.location,
                type: 'NumberLiteral',
                value: peekToken.value,
            };
        }

        if (peekToken.type === 'string') {
            this.tokenManager.eat('string');

            return {
                id: uuid(),
                location: peekToken.location,
                type: 'StringLiteral',
                value: peekToken.value,
            };
        }

        if (peekToken.type === 'identifier') {
            this.tokenManager.eat('identifier');

            return {
                id: uuid(),
                location: peekToken.location,
                type: 'Identifier',
                name: peekToken.value,
            };
        }

        throw new Error(`Unexpected token: ${peekToken.type}`);
    }

    // Parse Expression được bọc trong () - ví dụ: (x + 1)
    private parseParenthesizedExpression(): ParenthesizedExpression {
        const startToken = this.tokenManager.eat('(').location.start;
        const expression = this.parseExpression();
        const endToken = this.tokenManager.eat(')').location.end;

        return {
            id: uuid(),
            location: { start: startToken, end: endToken },
            type: 'ParenthesizedExpression',
            expressions: expression,
        };
    }

    // Parse danh sách Expressions cách nhau bằng dấu , - dùng cho array elements và call arguments
    private parseExpressionList(): Expression[] {
        const expressions: Expression[] = [this.parseExpression()];

        while (this.tokenManager.peek().type === ',') {
            this.tokenManager.eat(',');
            // Cho phép trailing comma: [1, 2,] - nếu không còn Expression thì dừng
            if (isExpressionLookahead(this.tokenManager.peek())) expressions.push(this.parseExpression());
        }

        return expressions;
    }

    // Parse array literal - [1, "hello", fn(x)] hoặc [] nếu rỗng
    private parseArrayLiteral(): ArrayLiteral {
        const startToken = this.tokenManager.eat('[').location.start;

        const elements = isExpressionLookahead(this.tokenManager.peek()) ? this.parseExpressionList() : [];

        const endToken = this.tokenManager.eat(']').location.end;

        return {
            id: uuid(),
            location: { start: startToken, end: endToken },
            type: 'ArrayLiteral',
            elements: elements,
        };
    }

    // Parse một cặp key-value trong object literal
    // ExpressionKey:  { [x + 1]: "value" } - key được tính từ Expression
    // IdentifierKey:  { name: "John" }     - key là tên trực tiếp
    // Primitive key:  { 42: "value" }      - key là literal (number, string)
    private parseKVPair(): KVPair {
        let key: IdentifierKey | ExpressionKey;

        // ExpressionKey { [x + 1]: "value" }
        if (this.tokenManager.peek().type === '[') {
            this.tokenManager.eat('[');
            const expression = this.parseExpression();
            this.tokenManager.eat(']');
            key = {
                type: 'ExpressionKey',
                expression: expression,
            };
        } else {
            // IdentifierKey
            const primitive = this.parsePrimitive();
            if (primitive.type === 'Identifier')
                key = {
                    type: 'IdentifierKey',
                    identifier: primitive,
                };
            else
                // primitive khác (number, string) cũng có thể là key: { 42: "value" }
                key = {
                    type: 'ExpressionKey',
                    expression: primitive,
                };
        }

        this.tokenManager.eat(':');
        const value = this.parseExpression();

        return [key, value];
    }

    // Parse danh sách key-value pairs cách nhau bằng , - cho phép trailing comma
    private parseKVPairs(): KVPair[] {
        const pairs: KVPair[] = [this.parseKVPair()];

        while (this.tokenManager.peek().type === ',') {
            this.tokenManager.eat(',');

            if (isKVPairLookahead(this.tokenManager.peek())) pairs.push(this.parseKVPair());
        }

        return pairs;
    }

    // Parse object literal - { name: "John", age: 25 } hoặc {} nếu rỗng
    private parseObjectLiteral(): ObjectLiteral {
        const startToken = this.tokenManager.eat('{').location.start;

        const pairs = isKVPairLookahead(this.tokenManager.peek()) ? this.parseKVPairs() : [];

        const endToken = this.tokenManager.eat('}').location.end;

        return {
            id: uuid(),
            location: { start: startToken, end: endToken },
            type: 'ObjectLiteral',
            pairs: pairs,
        };
    }

    // Atom là Expression không thể chia nhỏ hơn
    private parseAtom(): Atom {
        const peekToken = this.tokenManager.peek();

        if (isPrimitiveLookahead(peekToken)) return this.parsePrimitive();
        else if (peekToken.type === '(') return this.parseParenthesizedExpression();
        else if (peekToken.type === '[') return this.parseArrayLiteral();
        else if (peekToken.type === '{') return this.parseObjectLiteral();

        throw new Error(`Unexpected token: ${peekToken.type}`);
    }

    // Xử lý property access (.), element access ([]) và function call (()) sau một Atom
    // Mỗi lần lặp bọc leftNode cũ vào một node mới - cho phép chain: obj.method(x)[0].name → PropAccess → Call → ElementAccess → PropAccess
    private parseAccessOrCallExpression(): Expression {
        let leftNode: Expression = this.parseAtom();

        while (true) {
            const peekToken = this.tokenManager.peek();

            // obj.method - eat dấu . rồi đọc tên property
            if (peekToken.type === '.') {
                this.tokenManager.eat('.');

                const token = this.tokenManager.eat('identifier') as IdentifierToken;

                // Tạo Identifier node từ token
                const property: Identifier = {
                    id: uuid(),
                    location: token.location,
                    type: 'Identifier',
                    name: token.value,
                };

                leftNode = {
                    id: uuid(),
                    type: 'PropAccess',
                    location: { start: leftNode.location.start, end: property.location.end },
                    target: leftNode, // Identifier { name: "obj" },  ← Bọc leftNode cũ vào một node mới.
                    property: property, // Identifier { name: "method" }
                };
            } else if (peekToken.type === '[') {
                // arr[0] - eat [ rồi parseExpression bên trong làm index, kết thúc bằng ]
                this.tokenManager.eat('[');

                const index = this.parseExpression();
                const endToken = this.tokenManager.eat(']').location.end;

                leftNode = {
                    id: uuid(),
                    type: 'ElementAccess',
                    location: { start: leftNode.location.start, end: endToken },
                    target: leftNode,
                    index: index, // NumberLiteral { value: 0 }
                };
            } else if (peekToken.type === '(') {
                // fn(a, b) - eat ( rồi parse argument list, kết thúc bằng )
                this.tokenManager.eat('(');

                // Nếu không có argument nào thì là call rỗng fn()
                const args = isExpressionLookahead(this.tokenManager.peek()) ? this.parseExpressionList() : [];

                const endToken = this.tokenManager.eat(')').location.end;

                leftNode = {
                    id: uuid(),
                    type: 'Call',
                    location: { start: leftNode.location.start, end: endToken },
                    target: leftNode,
                    arguments: args, // [Identifier { name: "x" }]
                };
            } else break;
        }

        return leftNode;
    }

    private parseExpression(): Expression {
        throw new Error('Not implemented');
    }

    private parseAssignmentOrExpressionStatement(): AssignmentStatement | ExpressionStatement {
        throw new Error('Not implemented');
    }

    private parseStatement(): Statement {
        const peekToken = this.tokenManager.peek();

        if (isIfStatementLookahead(peekToken)) return this.parseIfStatement();
        if (isWhileLoopLookahead(peekToken)) return this.parseWhileLoop();
        if (isFunctionDeclarationLookahead(peekToken)) return this.parseFunctionDeclaration();
        if (isReturnStatementLookahead(peekToken)) return this.parseReturnStatement();
        if (isExpressionLookahead(peekToken)) return this.parseAssignmentOrExpressionStatement();

        throw new Error(`Unexpected token: ${peekToken.type}`);
    }

    private parseIfStatement(): IfStatement {
        throw new Error('Not implemented');
    }

    private parseWhileLoop(): WhileLoop {
        throw new Error('Not implemented');
    }

    private parseFunctionDeclaration(): FunctionDeclaration {
        throw new Error('Not implemented');
    }

    private parseReturnStatement(): ReturnStatement {
        const startToken = this.tokenManager.eat('return').location.start;

        let expression: Expression | undefined;
        if (isExpressionLookahead(this.tokenManager.peek())) {
            expression = this.parseExpression();
        }

        const endToken = this.tokenManager.eat(';').location.end;

        return {
            id: uuid(),
            location: { start: startToken, end: endToken },
            type: 'ReturnStatement',
            expression,
        };
    }
}
