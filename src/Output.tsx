interface OutputProperties {
    output: string[];
    onClear: () => void;
}

export function Output(properties: OutputProperties) {
    return (
        <div>
            <h1>Output</h1>
            <button onClick={properties.onClear}>Clear</button>
            {properties.output.map((value, index) => (
                <pre key={index}>{value}</pre>
            ))}
        </div>
    );
}
