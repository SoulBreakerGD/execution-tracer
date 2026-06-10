import { useRef, useState } from 'react';
import { Code } from './Code';
import { Output } from './Output';
import { Control } from './Control';
import { Tokenizer, TokenManager } from './interpreter/frontend/tokenizer';
import { Parser } from './interpreter/frontend/parser';
import { Executor, executor } from './interpreter/backend/run';
import type { ASTNode, ASTNodeId, Block } from './interpreter/frontend/ast';

interface BaseState {
    code: string;
    breakpoints: number[]; // breakpoint line numbers do CodeMirror trả về
    output: string[];
}

// Program chưa chạy hoặc đã chạy xong, editor có thể edit
interface IdleState extends BaseState {
    type: 'idle';
}

// Program đang chạy từng bước, editor readonly, executor còn sống trong ref
interface ExecutingState extends BaseState {
    type: 'executing';
    program: Block; // Giữ lại AST để map breakpoints mỗi khi người dùng thêm/xóa
}

// CodeMirror chỉ biết line numbers, nhưng executor cần ASTNodeId để set breakpoint
// Hàm này walk AST, tìm statement nào bắt đầu ở dòng đó, lấy id của nó
// remaining dùng Set để tránh walk không cần thiết sau khi đã tìm đủ
function getBreakpointNodes(breakpoints: number[], program: Block): ASTNodeId[] {
    const remaining = new Set(breakpoints);
    const nodes = new Set<ASTNodeId>();

    const walk = (node: ASTNode) => {
        switch (node.type) {
            case 'Block':
                for (const statement of node.statements) {
                    if (remaining.has(statement.location.start.line)) {
                        nodes.add(statement.id);
                        remaining.delete(statement.location.start.line);
                    }

                    walk(statement);
                }

                break;
            case 'IfStatement':
                walk(node.body);

                for (const elseIf of node.elseIfs) {
                    walk(elseIf.body);
                }

                if (node.else) {
                    walk(node.else);
                }

                break;
            case 'WhileLoop':
            case 'FunctionDeclaration':
                walk(node.body);
                break;
        }
    };

    walk(program);

    return Array.from(nodes);
}

export function App() {
    // useRef vì Executor không phải UI state - thay đổi không cần re-render
    // null khi idle, Executor instance khi executing
    const executorRef = useRef<Executor>(null);
    const [state, setState] = useState<IdleState | ExecutingState>({
        type: 'idle',
        code: '\n\n\n\n',
        breakpoints: [],
        output: [],
    });

    const handleRun = () => {
        if (state.type === 'idle') {
            // Parse source code thành AST mỗi lần Run từ idle
            const tokens = new TokenManager(new Tokenizer(state.code).tokenize());
            const ast = new Parser(tokens).parse();

            // Tạo executor mới, lưu vào ref để tái dùng qua nhiều lần advance()
            executorRef.current = executor(ast);

            // Map line numbers → node IDs rồi register vào executor
            for (const id of getBreakpointNodes(state.breakpoints, ast)) {
                executorRef.current.addBreakpoint(id);
            }

            const result = executorRef.current.advance();

            if (result.finished) {
                // Chạy xong ngay (không có breakpoint hoặc breakpoint không được hit)
                setState({
                    type: 'idle',
                    code: state.code,
                    breakpoints: state.breakpoints,
                    output: [...state.output, ...result.output],
                });

                executorRef.current = null;
            } else {
                // Đang chạy - chuyển sang executing để lock editor
                setState({
                    type: 'executing',
                    code: state.code,
                    breakpoints: state.breakpoints,
                    output: [...state.output, ...result.output],
                    program: ast,
                });
            }
        }

        if (state.type === 'executing') {
            // Tiếp tục từ breakpoint hoặc bước trước - dùng lại executor đã có
            const result = executorRef.current!.advance();

            if (result.finished) {
                setState({
                    type: 'idle',
                    code: state.code,
                    breakpoints: state.breakpoints,
                    output: [...state.output, ...result.output],
                });

                executorRef.current = null;
            } else {
                setState({
                    type: 'executing',
                    code: state.code,
                    breakpoints: state.breakpoints,
                    output: [...state.output, ...result.output],
                    program: state.program,
                });
            }
        }
    };

    return (
        <div style={{ display: 'flex' }}>
            <Code
                code={state.code}
                onChange={(code) => setState((state) => ({ ...state, code }))}
                onBreakpoint={(breakpoints) => {
                    if (executorRef.current && state.type === 'executing') {
                        executorRef.current.clearBreakpoints();

                        for (const id of getBreakpointNodes(breakpoints, state.program)) {
                            executorRef.current.addBreakpoint(id);
                        }
                    }

                    // Sync breakpoint line numbers vào state - dùng lại khi Run
                    setState((state) => ({ ...state, breakpoints: breakpoints }));
                }}
            />
            <Control
                onRun={handleRun}
                onStop={
                    state.type === 'executing'
                        ? () => {
                              executorRef.current = null;
                              setState((state) => ({ ...state, type: 'idle' }));
                          }
                        : undefined
                }
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
