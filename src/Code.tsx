import ReactCodeMirror from '@uiw/react-codemirror';
import { breakpointEffect, breakpointGutter, breakpointState } from './codemirror/breakpoints';

interface CodeProperties {
    code: string;
    onChange: (code: string) => void;
    onBreakpoint: (breakpoint: number[]) => void;
}

// Sử dụng CodeMirror để làm trình soạn thảo mã nguồn
// Hỗ trợ tính năng hiển thị số dòng, tô màu cú pháp và đặt breakpoint
export function Code(properties: CodeProperties) {
    return (
        <ReactCodeMirror
            style={{
                minWidth: 400,
            }}
            value={properties.code}
            onUpdate={(update) => {
                // Kiểm tra xem sự thay đổi (transaction) có chứa hiệu ứng bật/tắt breakpoint hay không
                const effectTriggered = update.transactions.some((transaction) =>
                    transaction.effects.some((effect) => effect.is(breakpointEffect)),
                );

                // Nếu người dùng thao tác breakpoint HOẶC nội dung code thay đổi (làm xê dịch dòng)
                if (effectTriggered || update.docChanged) {
                    const breakpoints: number[] = [];

                    // Duyệt qua toàn bộ document để tìm các vị trí đang được đặt marker breakpoint
                    update.state.field(breakpointState).between(0, update.state.doc.length, (from) => {
                        // Chuyển đổi vị trí index của CodeMirror sang số dòng (line number) thực tế
                        breakpoints.push(update.state.doc.lineAt(from).number);
                    });

                    properties.onBreakpoint(breakpoints);
                }
            }}
            onChange={properties.onChange}
            // Tích hợp extension tùy chỉnh để hiển thị cột lề chứa dấu chấm breakpoint
            extensions={[breakpointGutter]}
        />
    );
}
