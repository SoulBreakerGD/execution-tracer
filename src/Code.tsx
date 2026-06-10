import ReactCodeMirror from '@uiw/react-codemirror';

interface CodeProperties {
    code: string;
    onChange: (code: string) => void;
}

export function Code(properties: CodeProperties) {
    return (
        <ReactCodeMirror
            style={{
                minWidth: 400,
            }}
            value={properties.code}
            onChange={properties.onChange}
        />
    );
}
