export interface Position {
    line: number
    column: number
}

export type SourceCodeSpan = {
    start: Position
    end: Position
}
