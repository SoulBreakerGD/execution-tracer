// Tokenizer.tokenize() → Token[]
//     ↓
// new TokenManager(tokens)
//     ↓
// new Parser(tokenManager)
import { uuid } from '../utils';
import {
    AssignmentStatement,
    Block,
    Expression,
    ExpressionStatement,
    FunctionDeclaration,
    IfStatement,
    ReturnStatement,
    Statement,
    WhileLoop,
} from './ast';
import { type Token, TokenManager } from './tokenizer';

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

    // Đọc statements cho đến khi gặp } hoặc EOF
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

    // Entry point bên ngoài gọi, đọc 1 block chứa tất cả statements của program (toàn bộ Array token từ đầu đến EOF, return root note của AST)
    // eat('EOF') để đảm bảo đã đọc toàn bộ input
    public parse(): Block {
        const programBlock: Block = this.parseBlock();

        this.tokenManager.eat('EOF');

        return programBlock;
    }

    private parseAssignmentOrExpressionStatement(): AssignmentStatement | ExpressionStatement {
        throw new Error('Not implemented');
    }

    private parseExpression(): Expression {
        throw new Error('Not implemented');
    }

    private parseStatement(): Statement {
        const currentToken = this.tokenManager.peek();

        if (isIfStatementLookahead(currentToken)) return this.parseIfStatement();
        if (isWhileLoopLookahead(currentToken)) return this.parseWhileLoop();
        if (isFunctionDeclarationLookahead(currentToken)) return this.parseFunctionDeclaration();
        if (isReturnStatementLookahead(currentToken)) return this.parseReturnStatement();
        if (isExpressionLookahead(currentToken)) return this.parseAssignmentOrExpressionStatement();

        throw new Error(`Unexpected token: ${currentToken.type}`);
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
