interface ControlProperties {
    onRun: () => void;
    onStop?: () => void;
}

export function Control(properties: ControlProperties) {
    return (
        <div style={{ display: 'flex' }}>
            <button onClick={properties.onRun}>Run</button>
            <button onClick={properties.onStop} disabled={!properties.onStop}>
                Stop
            </button>
        </div>
    );
}
