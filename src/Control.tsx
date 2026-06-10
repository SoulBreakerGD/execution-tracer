interface ControlProperties {
    onRun: () => void;
    onStop?: () => void;
}

export function Control(properties: ControlProperties) {
    return (
        <div style={{ display: 'flex' }}>
            <button onClick={properties.onRun} style={{ height: 30 }}>
                Run
            </button>
            <button onClick={properties.onStop} disabled={!properties.onStop} style={{ height: 30 }}>
                Stop
            </button>
        </div>
    );
}
