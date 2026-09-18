import { SourceCodeSpan } from './diagnostics'

export class SemanticError extends Error {
    private constructor(
        message: string,
        public readonly span: SourceCodeSpan,
    ) {
        super(message)
    }

    static create({
        message,
        span,
    }: {
        message: string
        span: SourceCodeSpan
    }) {
        return new SemanticError(message, span)
    }
}

export class SemanticErrorCollection extends Error {
    private constructor(public readonly errors: SemanticError[]) {
        super(errors.map((e) => e.message).join('\n'))
    }

    static create(errors: SemanticError[]): SemanticErrorCollection {
        return new SemanticErrorCollection(errors)
    }

    add(...errors: SemanticError[]): void {
        this.errors.push(...errors)
        this.message = this.errors.map((e) => e.message).join('\n')
    }
}
