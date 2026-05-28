import { executor } from './backend/run';
import { Parser } from './frontend/parser';
import { Tokenizer, TokenManager } from './frontend/tokenizer';

const program = `
fn computeFibonacci(n) {
    if (n <= 1) {
        return n;
    } else {
        return computeFibonacci(n - 1) + computeFibonacci(n - 2);
    }
}

fn createTestTree(depth, maxDepth) {
    node = {
        level: depth,
        isTerminal: depth >= maxDepth,
        children: [ ],
    };

    if(!node.isTerminal) {
        node.children[0] = createTestTree(depth + 1, maxDepth);
        node.children[1] = createTestTree(depth + 1, maxDepth);
    } else if (depth == maxDepth) {
        node.leafData = depth * 100 / 2 % 7;
    } else {
        node.error = true;
    }

    return node;
}

fn validateParserCapabilities(startValue, stringKey) {
    numberTest = +startValue * -5 / 2 % 3 + 10.5 - 1;
    logicTest = (numberTest > 0) && true || false != null;
    equalityTest = numberTest < 10 == !!!false;

    dynamicString = stringKey + "Suffix";

    complexPayload = {
        "staticKey": "Hello",
        identifierKey: 42,
        [dynamicString]: [
            computeFibonacci(5),
            logicTest,
            equalityTest,
            [ null, true, false,],
        ],
        nestedStructures: {
            emptyArray: [ ],
            emptyObject: { }
        }
    };

    iteration = 0;
    while (iteration < 3) {
        complexPayload.nestedStructures.emptyArray[iteration] = createTestTree(0);
        iteration = iteration + 1;
    }

    return complexPayload;

    fn triggerSideEffect() {
        return null;
    }

    triggerSideEffect();

    executionResult = validateParserCapabilities(10, "dynamicData",);
    executionResult.status = "Success";
    executionResult.metadata = {
        time: 12345678,
        verified: true,
    };
}
    
`;

const tokens = new TokenManager(new Tokenizer(program).tokenize());
const parser = new Parser(tokens);
const ast = parser.parse();
const execute = executor(ast);
execute.advance();
