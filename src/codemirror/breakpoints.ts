import { gutter, GutterMarker, RangeSet, StateEffect, StateField } from '@uiw/react-codemirror';

const breakpointMarker = new (class extends GutterMarker {
    toDOM() {
        const span = document.createElement('span');
        span.style.height = '100%';
        span.style.width = '100%';
        span.style.color = 'red';
        span.style.cursor = 'pointer';
        span.innerText = '●';
        return span;
    }
})();

interface BreakpointEffect {
    lineIndex: number;
    on: boolean;
}

export const breakpointEffect = StateEffect.define<BreakpointEffect>();

export const breakpointState = StateField.define({
    create() {
        return RangeSet.empty;
    },
    update(set, transaction) {
        set = set.map(transaction.changes); // if we don't have this, then breakpoints don't get shifted down
        for (let e of transaction.effects) {
            if (e.is(breakpointEffect)) {
                if (e.value.on) {
                    set = set.update({ add: [breakpointMarker.range(e.value.lineIndex)] });
                } else {
                    set = set.update({ filter: (from) => from !== e.value.lineIndex });
                }
            }
        }
        return set;
    },
});

export const breakpointGutter = [
    breakpointState,
    gutter({
        markers: (view) => view.state.field(breakpointState),
        initialSpacer: () => breakpointMarker,
        domEventHandlers: {
            mousedown(view, line) {
                let breakpoints = view.state.field(breakpointState);
                let hasBreakpoint = false;
                breakpoints.between(line.from, line.from, () => {
                    hasBreakpoint = true;
                });

                view.dispatch({
                    effects: breakpointEffect.of({ lineIndex: line.from, on: !hasBreakpoint }),
                });

                return true;
            },
        },
    }),
];
