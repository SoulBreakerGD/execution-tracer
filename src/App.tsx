import { useState } from 'react';
import { Code } from './Code';
import { Output } from './Output';
import { Control } from './Control';
import { Tokenizer, TokenManager } from './interpreter/frontend/tokenizer';
import { Parser } from './interpreter/frontend/parser';
import { executor } from './interpreter/backend/run';

interface BaseState {
    code: string;
    output: string[];
}

export function App() {
    const [state, setState] = useState<BaseState>({
        code: '\n\n\n\n',
        output: [],
    });

    return (
        <div style={{ display: 'flex' }}>
            <Code code={state.code} onChange={(code) => setState((state) => ({ ...state, code }))} />
            <Control
                onRun={() => {
                    const tokens = new TokenManager(new Tokenizer(state.code).tokenize());
                    const parser = new Parser(tokens);
                    const ast = parser.parse();
                    const execute = executor(ast);
                    const output = execute.advance();
                    setState((state) => ({ ...state, output: output.output }));
                }}
                onStop={() => console.log('stop')}
            />
            <Output
                output={state.output}
                onClear={() => {
                    setState((state) => ({ ...state, output: [] }));
                }}
            />
        </div>
    );
}
