import ReactCodeMirror from '@uiw/react-codemirror';
import { breakpointEffect, breakpointGutter, breakpointState } from './codemirror/breakpoints';

interface CodeProperties {
    code: string;
    onChange: (code: string) => void;
    onBreakpoint: (breakpoint: number[]) => void;
}

export function Code(properties: CodeProperties) {
    return (
        <ReactCodeMirror
            style={{
                minWidth: 400,
            }}
            value={properties.code}
            onUpdate={(update) => {
                const effectTriggered = update.transactions.some((transaction) =>
                    transaction.effects.some((effect) => effect.is(breakpointEffect)),
                );

                if (effectTriggered || update.docChanged) {
                    const breakpoints: number[] = [];

                    update.state.field(breakpointState).between(0, update.state.doc.length, (from) => {
                        breakpoints.push(update.state.doc.lineAt(from).number);
                    });

                    properties.onBreakpoint(breakpoints);
                }
            }}
            onChange={properties.onChange}
            extensions={[breakpointGutter]}
        />
    );
}
