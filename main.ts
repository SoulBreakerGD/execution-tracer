import { executor } from './backend/run';
import { Parser } from './frontend/parser';
import { Tokenizer, TokenManager } from './frontend/tokenizer';

const program = `
"hello";

`;

const tokens = new TokenManager(new Tokenizer(program).tokenize());
const parser = new Parser(tokens);
const ast = parser.parse();
const execute = executor(ast);
execute.advance();
