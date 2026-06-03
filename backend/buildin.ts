// Module để xử lý việc hiển thị dữ liệu
// Nhận vào các runtime value trên Heap, chuyển thành string để hiển thị lên console
import type { ArrayValue, Heap, ObjectValue, PrimitiveValue, RuntimeValue } from './memory';

function printPrimitive(value: PrimitiveValue): string {
    if (value.type === 'null') {
        return 'null';
    }

    if (value.type === 'string') {
        return `"${value.value}"`;
    }

    return String(value.value);
}

// Chuyển Object value thành string: { "key1": value1, "key2": value2 }
// Object trên Heap chỉ lưu Pointer cho mỗi property - không lưu value trực tiếp
// Phải dùng heap.get(pointer) để lấy value thực, rồi gọi đệ quy printAny
// để handle trường hợp property là object/array lồng nhau
function printObject(heap: Heap, value: ObjectValue): string {
    const strings: string[] = [];

    for (const [key, pointer] of Object.entries(value.properties)) {
        strings.push(`"${key}": ${printAny(heap, heap.get(pointer))}`);
    }

    return `{ ${strings.join(', ')} }`;
}

// Chuyển Array value thành string: [ value1, value2, value3 ]
// Tương tự Object, Array lưu danh sách Pointer thay vì value trực tiếp
// Duyệt qua từng Pointer, heap.get() để lấy value, gọi đệ quy printAny
function printArray(heap: Heap, value: ArrayValue): string {
    const strings: string[] = [];

    for (const element of value.elements) {
        strings.push(printAny(heap, heap.get(element)));
    }

    return `[ ${strings.join(', ')} ]`;
}

// Entry point
export function printAny(heap: Heap, value: RuntimeValue): string {
    switch (value.type) {
        case 'number':
        case 'string':
        case 'boolean':
        case 'null':
            return printPrimitive(value);
        case 'object':
            return printObject(heap, value);
        case 'array':
            return printArray(heap, value);
        case 'function':
        case 'builtinfunction':
            throw new Error(`Cannot print ${value.type}`);
    }
}
