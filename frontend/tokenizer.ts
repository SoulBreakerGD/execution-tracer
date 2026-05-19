// Vị trí của một ký tự trong code
interface Position {
    line: number;
    column: number; // Vị trí trong line hiện tại, reset về 1 khi xuống line mới
    index: number; // Vị trí trong toàn bộ program string
}

// Điểm bắt đầu và kết thúc của một token, có tác dụng để highlight về sau
interface TokenLocation {
    start: Position;
    end: Position;
}

// Bất cứ token nào đều có vị trí của nó
interface BaseToken {
    location: TokenLocation;
}

type KeywordType = 'if' | 'else' | 'while' | 'true' | 'false' | 'null' | 'fn' | 'return';
interface KeywordToken extends BaseToken {
    type: KeywordType;
}

interface IdentifierToken extends BaseToken {
    type: 'identifier';
    value: string;
}

interface StringToken extends BaseToken {
    type: 'string';
    value: string;
}

interface NumberToken extends BaseToken {
    type: 'number';
    value: number;
}

// prettier-ignore
type SymbolType = '(' | ')' | '[' | ']' | '{' | '}' | '.' | ',' | '+' | '-' | '*' | '/' | '%' | '&&' | '||' | '!' | '<' | '>' | '=' | '<=' | '>=' | '==' | '!=' | ';' | ':';
interface SymbolToken extends BaseToken {
    type: SymbolType;
}

interface EOFToken extends BaseToken {
    type: 'EOF';
}

type TokenType = KeywordType | 'identifier' | 'string' | 'number' | SymbolType | 'EOF';
type Token = KeywordToken | IdentifierToken | StringToken | NumberToken | SymbolToken | EOFToken;

const keywords = new Set(['if', 'else', 'while', 'true', 'false', 'null', 'fn', 'return']);
function isKeyword(s: string): s is KeywordType {
    // Nếu function này trả về true, thì hãy tin rằng s lúc này có type là KeywordType
    return keywords.has(s);
}

const alpha = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
function isAlpha(c: string) {
    return alpha.has(c);
}

const digit = new Set('0123456789');
function isDigit(c: string) {
    return digit.has(c);
}

function isAlphaNumeric(c: string) {
    return isAlpha(c) || isDigit(c);
}

// prettier-ignore
const oneCharSymbols = new Set(['(', ')', '[', ']', '{', '}', '.', ',', '+', '-', '*', '/', '%', '!', '<', '>', '=', ';', ':']);
function isOneCharSymbol(c: string) {
    return oneCharSymbols.has(c);
}

const twoCharSymbols = new Set(['<=', '>=', '==', '!=', '&&', '||']);
function isTwoCharSymbol(c: string) {
    return twoCharSymbols.has(c);
}

// Con trỏ để Tokenizer biết nó đang đọc đến đâu trong code
class Incrementer {
    // private - chỉ class Incrementer được đọc và ghi position, bên ngoài không thể làm incrementer.position.index = 999 để nhảy con trỏ tùy tiện - mọi thay đổi phải đi qua advance() và newline() (encapsulation)
    // readonly - this.position không thể bị gán thành object khác hoàn toàn, các field bên trong vẫn có thể thay đổi
    private readonly position: Position = { line: 1, column: 1, index: 0 };

    // Di chuyển con trỏ tiến lên một ký tự
    advance() {
        this.position.index++;
        this.position.column++;
    }

    // Gọi để xuống line mới khi gặp ký tự \n
    newline() {
        this.position.line++;
        this.position.column = 1;
    }

    // Trả về copy của position hiện tại
    snapshot() {
        return { ...this.position }; // Tạo một object mới với tất cả fields được copy sang (shallow copy)
    }

    // Tokenizer cần index để biết đang trỏ vào kí tự nào nhưng position là private
    // Method này để expose index mà không expose cả object.position
    index(): number {
        return this.position.index;
    }
}

class Tokenizer {
    private readonly program: string; // Source code gốc, đọc từ đầu đến cuối, ko thay đổi
    private readonly incrementer: Incrementer = new Incrementer(); // Con trỏ để xem Tokenizer đang đọc tới đâu

    constructor(program: string) {
        this.program = program;
    }

    tokenize() {
        const tokens: Token[] = [];

        // Đọc từng ký tự cho đến khi hết source code
        while (this.incrementer.index() < this.program.length) {
            const currentCharacter = this.program[this.incrementer.index()];
            const nextCharacter = this.program[this.incrementer.index() + 1];

            // Bắt đầu bằng chữ cái - có thể là identifier hoặc keyword
            if (isAlpha(currentCharacter)) {
                tokens.push(this.identifierOrKeyword());
                continue;
            }

            // Bắt đầu bằng chữ số - number literal
            if (isDigit(currentCharacter)) {
                tokens.push(this.number());
                continue;
            }

            // Bắt đầu bằng dấu nháy kép - string literal
            if (currentCharacter === '"') {
                tokens.push(this.string());
                continue;
            }

            // Nhìn 2 ký tự cùng lúc - phải check trước oneCharSymbol
            if (isTwoCharSymbol(`${currentCharacter}${nextCharacter}`)) {
                tokens.push(this.twoCharSymbol());
                continue;
            }

            if (isOneCharSymbol(`${currentCharacter}`)) {
                tokens.push(this.oneCharSymbol());
                continue;
            }

            // Khoảng trắng - bỏ qua, chỉ advance con trỏ
            if (currentCharacter === ' ') {
                this.incrementer.advance();
                continue;
            }

            // Xuống dòng - advance con trỏ và reset column về 1
            if (currentCharacter === '\n') {
                this.incrementer.advance();
                this.incrementer.newline();
                continue;
            }

            throw new Error(`Unexpected character: ${currentCharacter}`);
        }

        // Luôn kết thúc bằng EOF để Parser biết đã hết input
        tokens.push({
            type: 'EOF',
            location: { start: this.incrementer.snapshot(), end: this.incrementer.snapshot() },
        });

        return tokens;
    }

    identifierOrKeyword(): IdentifierToken | KeywordToken {
        const startToken = this.incrementer.snapshot();
        let token = '';

        // Đọc liên tục chừng nào còn là chữ cái hoặc chữ số
        // Ví dụ: "myVar123" đọc hết, dừng khi gặp space hoặc symbol
        while (isAlphaNumeric(this.program[this.incrementer.index()])) {
            token += this.program[this.incrementer.index()];
            this.incrementer.advance();
        }

        const endToken = this.incrementer.snapshot();

        // Kiểm tra chuỗi vừa đọc có nằm trong danh sách keywords không
        // Nếu có - KeywordToken (type chính là keyword đó, không cần value riêng)
        // Nếu không - IdentifierToken (tên do người dùng đặt, lưu vào value)
        if (isKeyword(token))
            return {
                type: token,
                location: { start: startToken, end: endToken },
            };

        return {
            type: 'identifier',
            value: token,
            location: { start: startToken, end: endToken },
        };
    }

    number(): NumberToken {
        const startToken = this.incrementer.snapshot();
        let token = '';
        let hasDecimal = false;

        // Chỉ kiểm tra 1 lần xem token này đã có dấu . chưa
        while (
            isDigit(this.program[this.incrementer.index()]) ||
            (this.program[this.incrementer.index()] === '.' && !hasDecimal)
        ) {
            if (this.program[this.incrementer.index()] === '.') {
                hasDecimal = true;
            }

            token += this.program[this.incrementer.index()];
            this.incrementer.advance();
        }

        const endToken = this.incrementer.snapshot();

        return {
            type: 'number',
            value: Number(token),
            location: { start: startToken, end: endToken },
        };
    }

    string(): StringToken {
        const startToken = this.incrementer.snapshot();
        let token = '';

        this.incrementer.advance(); // Bỏ qua dấu " mở
        while (
            this.incrementer.index() < this.program.length &&
            this.program[this.incrementer.index()] !== '"'
        ) {
            token += this.program[this.incrementer.index()];
            this.incrementer.advance();
        }

        // Edge case: Nếu không có dấu " đóng, vòng lặp sẽ chạy vượt qua program.length
        if (
            this.incrementer.index() >= this.program.length ||
            this.program[this.incrementer.index()] !== '"'
        ) {
            throw new Error(`Unterminated string at line ${startToken.line}`);
        }

        this.incrementer.advance(); // Bỏ qua dấu " đóng

        const endToken = this.incrementer.snapshot();

        return {
            type: 'string',
            value: token,
            location: { start: startToken, end: endToken },
        };
    }

    twoCharSymbol(): SymbolToken {
        const startToken = this.incrementer.snapshot();
        const token = `${this.program[this.incrementer.index()]}${this.program[this.incrementer.index() + 1]}`; // Chỉ lấy đúng 2 ký tự, không cần vòng lặp while

        this.incrementer.advance();
        this.incrementer.advance();

        const endToken = this.incrementer.snapshot();

        return {
            type: token as SymbolType,
            location: { start: startToken, end: endToken },
        };
    }

    oneCharSymbol(): SymbolToken {
        const startToken = this.incrementer.snapshot();
        const token = `${this.program[this.incrementer.index()]}`;

        this.incrementer.advance();

        const endToken = this.incrementer.snapshot();

        return {
            type: token as SymbolType,
            location: { start: startToken, end: endToken },
        };
    }
}

// Con trỏ đọc Array token
class TokenManager {
    private readonly tokens: Array<Token> = [];
    private index = 0; // Track vị trí trong Array token

    constructor(tokens: Array<Token>) {
        this.tokens = tokens;
    }

    // Chỉ nhìn vào token vị trí hiện tại rồi return
    peek(): Token {
        return this.tokens[this.index];
    }

    // Kiểm tra token vị trí hiện tại có phải type thằng eat() đang mong đợi hay không, nếu có thì return token đó, không thì ném lỗi
    eat(expectedType: TokenType | TokenType[]): Token {
        const token = this.tokens[this.index];
        const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType]; // Thống nhất thành một Array có 1 hoặc nhiều phần tử

        if (expectedTypes.includes(token.type)) {
            this.index++;
            return token;
        } else throw new Error(`Expected ${expectedTypes.join(', ')} but got '${token.type}'`);
    }
}
