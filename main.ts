import { executor } from './backend/run';
import { Parser } from './frontend/parser';
import { Tokenizer, TokenManager } from './frontend/tokenizer';

const program = `
print("hello");
print(123.12);
`;

const tokens = new TokenManager(new Tokenizer(program).tokenize());
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(JSON.stringify(ast));
const execute = executor(ast);

execute.addBreakpoint('3');
execute.addBreakpoint('7');

console.log(execute.advance());
console.log(execute.advance());
console.log(execute.advance());
