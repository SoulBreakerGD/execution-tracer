import { executor } from './backend/run';
import { Parser } from './frontend/parser';
import { Tokenizer, TokenManager } from './frontend/tokenizer';

const program = `
obj = {
a: 1,
};

print(obj.a);
`;

const tokens = new TokenManager(new Tokenizer(program).tokenize());
const parser = new Parser(tokens);
const ast = parser.parse();
console.log(JSON.stringify(ast));
const execute = executor(ast);

console.log(execute.advance());
