import type { ExternalValue, HeapSnapshot } from './interpreter/backend/diagnostics';
import type { Pointer, VariableName } from './interpreter/backend/memory';

// Entry là một dòng trong variable inspector - có thể là top-level variable hoặc
// element/property bên trong array/object đã được expand
interface Entry {
    variableName: string;
    value: string; // Đã stringify
    pointer: Pointer; // Dùng để toggle expand khi click
    depth: number; // Số lần indent - mỗi level thêm padding trái
    expandable: boolean; // Cho phép click để expand nếu là object hoặc array
}

type FrameId = string;

// Frame data từ backend, đã được App.tsx merge với expanded state trước khi truyền xuống
export interface InputFrame {
    frameId: FrameId;
    functionName: string;
    localVariables: Record<VariableName, Pointer>;
    expanded: Record<Pointer, boolean>; // Pointer nào đang được expand
}

// Frame đã được flatten - sẵn sàng để render, không cần xử lý thêm trong JSX
interface RenderFrame {
    frameId: FrameId;
    name: string;
    entries: Entry[];
}

interface StackProperties {
    callStack: InputFrame[];
    heap: HeapSnapshot;
}

// Chuyển ExternalValue thành string hiển thị
// Object và Array chỉ hiển thị placeholder - nội dung bên trong được flatten() xử lý
function stringify(value: ExternalValue): string {
    switch (value.type) {
        case 'string':
            return `"${value.value}"`;
        case 'number':
        case 'boolean':
            return `${value.value}`;
        case 'null':
            return 'null';
        case 'object':
            return '{ ... }';
        case 'array':
            return '[ ... ]';
        case 'function':
            return '<function>';
    }
}

// Chuyển flat Record<VariableName, Pointer> thành mảng Entry có depth
// để render như một indented tree - không cần nested JSX
//
// Dùng preorder traversal: parent luôn xuất hiện trước children
// expanded[pointer] quyết định có render children không
//
// Ví dụ output với arr = [1, 2] đang expanded:
//   { variableName: 'arr', depth: 0, expandable: true  }
//   { variableName: '0',   depth: 1, expandable: false }
//   { variableName: '1',   depth: 1, expandable: false }
function flatten(
    localVariables: Record<VariableName, Pointer>,
    heap: HeapSnapshot,
    expanded: Record<Pointer, boolean>,
): Entry[] {
    const entries: Entry[] = [];

    const preorder = (variableName: string, pointer: Pointer, depth: number) => {
        const value = heap[pointer];

        entries.push({
            variableName,
            value: stringify(value),
            pointer,
            depth,
            expandable: value.type === 'object' || value.type === 'array',
        });

        // Render children chỉ khi pointer này đang được expand
        if (value.type === 'array' && expanded[pointer]) {
            for (let i = 0; i < value.elements.length; i++) {
                preorder(`${i}`, value.elements[i], depth + 1);
            }
        }

        if (value.type === 'object' && expanded[pointer]) {
            for (const [name, ptr] of Object.entries(value.properties)) {
                preorder(name, ptr, depth + 1);
            }
        }
    };

    for (const [name, pointer] of Object.entries(localVariables)) {
        preorder(name, pointer, 0);
    }

    return entries;
}

// Hiển thị call stack và local variables của từng frame
// Mỗi frame render danh sách entries đã flatten - depth * padding tạo ra tree effect
export function Stack(properties: StackProperties) {
    const frames: RenderFrame[] = properties.callStack.map((frame) => ({
        frameId: frame.frameId,
        name: frame.functionName,
        entries: flatten(frame.localVariables, properties.heap, frame.expanded),
    }));

    return (
        <div style={{ marginLeft: 20 }}>
            <h1 style={{ marginBottom: 20 }}>Stack</h1>
            {frames.map((frame, i) => (
                <div key={i} style={{ border: '2px solid grey', padding: 20 }}>
                    <h4>{frame.name}</h4>
                    {frame.entries.map((entry, j) => (
                        // paddingLeft tạo visual indent cho children của array/object
                        <div key={`${i} ${j}`} style={{ paddingLeft: entry.depth * 12 }}>
                            <span>
                                {entry.variableName}: {entry.value}
                            </span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
