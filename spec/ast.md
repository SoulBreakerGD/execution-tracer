AST là gì?
Tokenizer trả về 1 dãy phẳng - tokens nối đuôi nhau theo thứ tự từ trái sang phải, không thể hiện mức độ ưu tiên.
[LET] [IDENTIFIER:x] [=] [NUMBER:1] [+] [NUMBER:2] [*] [NUMBER:3] [;]

<!-- prettier-ignore -->
AST giải quyết vấn đề này bằng cách biểu diễn dưới dạng cây - mỗi node là một cấu trúc ngữ pháp, child nodes là các thành phần bên trong:
        [=]
       /   \
    [x]    [+]
           / \
         [1] [*]
             / \
           [2] [3]
Interpreter chỉ cần walk cây từ dưới lên, tính 2 * 3 trước ra 6, rồi tính 1 + 6 ra 7, rồi gán vào x.

Các loại node trong AST:

- Literal nodes - giá trị cụ thể, không có child: NumberLiteral(42), StringLiteral("hello"), BooleanLiteral(true)
- Expression nodes - có child là các expressions khác:
    - BinaryExpression(left, operator, right) `1 + 2, x \* y`
    - UnaryExpression(operator, operand) `!true -x`
    - CallExpression(callee, arguments[]) `add(1, 2)`
- Statement nodes - các câu lệnh hoàn chỉnh:
    - LetStatement(name, value) `let x = 42`
    - ReturnStatement(value) `return x + 1`
    - IfStatement(condition, consequent, alternate) `if/else`
    - WhileStatement(condition, body) `while() { ... }`
    - FunctionDeclaration(name, params[], body) `fn add(x, y) { ... }`
- Program node - root của toàn bộ cây, chứa array tất cả statements.
