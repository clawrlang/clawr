import { SourceCodeSpan } from './diagnostics'

export class SourceError extends Error {
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
        return new SourceError(message, span)
    }
}

export class SourceErrorCollection extends Error {
    private constructor(public readonly errors: SourceError[]) {
        super(errors.map((e) => e.message).join('\n'))
    }

    static create(errors: SourceError[]): SourceErrorCollection {
        return new SourceErrorCollection(errors)
    }

    add(...errors: SourceError[]): void {
        this.errors.push(...errors)
        this.message = this.errors.map((e) => e.message).join('\n')
    }
}
