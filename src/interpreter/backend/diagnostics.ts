// Module để tạo snapshot của runtime state tại một thời điểm cụ thể để UI hiển thị sau mỗi bước advance()
import type { TokenLocation } from '../frontend/tokenizer';
import type { CallStack, FunctionValue, Heap, Pointer, RuntimeValue, VariableName } from './memory';

// Cấu trúc của một frame trong Call Stack dành cho việc hiển thị (Diagnostics)
export interface DiagnosticFrame {
    frameId: string;
    functionName: string;
    location: TokenLocation; // Location của node hiện tại trong code để UI highlight
    localVariables: Record<VariableName, Pointer>; // Danh sách các biến cục bộ và Pointer của chúng
}

// Tất cả RuntimeValue types đều giữ nguyên, chỉ riêng function/builtinfunction được flatten thành { type: 'function' }
// Vì FunctionValue chứa AST refs và LexicalEnvironment không thể serialize ra ngoài UI
export type ExternalValue = Exclude<RuntimeValue, FunctionValue> | { type: 'function' };
export type HeapSnapshot = Record<Pointer, ExternalValue>; // Bản sao ánh xạ từ Pointer đến giá trị vùng nhớ

// Hàm trích xuất dữ liệu Call Stack tại thời điểm hiện tại
export function stackDiagnostic(callStack: CallStack): DiagnosticFrame[] {
    // Chuyển đổi toàn bộ các frame trong Call Stack hiện tại sang định dạng hiển thị
    return callStack.all().map((frame) => ({
        frameId: frame.id,
        functionName: frame.functionName,
        location: frame.currentNode.location,
        localVariables: structuredClone(frame.environment.all()), // Dùng structuredClone() cho local variables - snapshot phải là bản copy độc lập, không phải reference vào live data
    }));
}

// Hàm trích xuất dữ liệu Heap tại thời điểm hiện tại
export function heapSnapshot(heap: Heap): HeapSnapshot {
    // Duyệt qua toàn bộ vùng nhớ Heap để lọc bỏ các thông tin nội bộ phức tạp
    const snapshot: HeapSnapshot = Object.fromEntries(
        Object.entries(heap.all()).map(([pointer, value]) => [
            pointer,
            // Đối với function/builtinfunction, chỉ cần báo hiệu cho UI biết đây là một 'function'
            value.type === 'function' || value.type === 'builtinfunction' ? { type: 'function' } : value,
        ]),
    );

    // Trả về bản copy hoàn toàn độc lập của snapshot vùng nhớ
    // Đảm bảo rằng dữ liệu mà UI đang hiển thị cho quá khứ là dữ liệu thực sự đã tồn tại lúc đó
    // Không bị ảnh hưởng bởi các thao tác ghi đè lên Heap sau này
    return structuredClone(snapshot);
}
