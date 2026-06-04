import { executor } from './backend/run';
import { Parser } from './frontend/parser';
import { Tokenizer, TokenManager } from './frontend/tokenizer';

const program = `
fn evaluateNumber(n) {
    print("Checking number:", n);

    if (n > 100) {
        print("  -> Result: This is a very large number!");
    }

    if (n % 2 == 0) {
        print("  -> Parity: Even");
    } else {
        print("  -> Parity: Odd");
    }

    if (n < 0) {
        print("  -> Category: Negative");
    } else if (n == 0) {
        print("  -> Category: Zero");
    } else if (n <= 10) {
        print("  -> Category: Small Positive");
    } else if (n <= 50) {
        print("  -> Category: Medium Positive");
    } else {
        print("  -> Category: Large Positive");
    }
    
    print("--- Evaluation Finished ---");
}

evaluateNumber(150);
evaluateNumber(25);
evaluateNumber(0);
evaluateNumber(-5);
`;

const tokens = new TokenManager(new Tokenizer(program).tokenize());
const parser = new Parser(tokens);
const ast = parser.parse();
const execute = executor(ast);

let result = execute.advance();

while (!result.finished) {
    if (result.printed.length > 0) {
        console.log(result.printed.join('\n'));
    }
    result = execute.advance();
}

if (result.printed.length > 0) {
    console.log(result.printed.join('\n'));
}
