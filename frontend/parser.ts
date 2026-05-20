// Tokenizer.tokenize() → Token[]
//     ↓
// new TokenManager(tokens)
//     ↓
// new Parser(tokenManager)
import { type Token, TokenManager } from './tokenizer';

// Các Lookahead functions để xác định cú pháp trước khi gọi hàm xử lý
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

    parse() {
        const statements = [];
        // while() {
        //     statements.push(this.parseStatement)
        // }
        return;
    }

    parseStatement() {
        const currentToken = this.tokenManager.peek();

        if (isIfStatementLookahead(currentToken)) return this.parseIfStatement();
        if (isWhileLoopLookahead(currentToken)) return this.parseWhileLoop();
        if (isFunctionDeclarationLookahead(currentToken)) return this.parseFunctionDeclaration();
        if (isReturnStatementLookahead(currentToken)) return this.parseReturnStatement();
        if (isExpressionLookahead(currentToken)) return this.parseAssignmentOrExpressionStatement();
    }

    parseIfStatement() {}

    parseWhileLoop() {}

    parseFunctionDeclaration() {}

    parseReturnStatement() {}

    parseAssignmentOrExpressionStatement() {}
}
