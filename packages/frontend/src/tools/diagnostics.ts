export interface Position {
    line: number
    column: number
    source?: string
}

export type SourceCodeSpan = {
    start: Position
    end: Position
}
