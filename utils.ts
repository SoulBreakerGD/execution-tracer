let id = 0;
export function uuid(): string {
    return (id++).toString();
}
