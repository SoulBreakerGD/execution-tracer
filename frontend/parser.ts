// Tokenizer.tokenize() → Token[]
//     ↓
// new TokenManager(tokens)
//     ↓
// new Parser(tokenManager)
import { type Token, TokenManager } from './tokenizer';

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
        const currentTokenType = this.tokenManager.peek().type;

        if (currentTokenType === 'if') {
            this.parseIfStatement();
        }
    }

    parseConstStatement() {}

    parseLetStatement() {}

    parseIfStatement() {}

    parseWhileStatement() {}

    parseFunctionDeclaration() {}

    parseReturnStatement() {}
}
