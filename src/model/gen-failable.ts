import { SourceCodeSpan } from '../diagnostics'
import { SemanticError, SemanticErrorCollection } from './failable'

type FailableResult =
    { errors: SemanticError[]; isFatal: boolean } | { value: any }
type IsFatalOption = { isFatal: true }

export class GeneratorFailable<T = void> {
    private constructor(private readonly result: FailableResult) {}

    static success<T>(value: T): GeneratorFailable<T> {
        return new GeneratorFailable<T>({ value })
    }

    static failure(
        message: string,
        span: SourceCodeSpan,
    ): GeneratorFailable<never>

    static failure(
        message: string,
        span: SourceCodeSpan,
        option: IsFatalOption,
    ): GeneratorFailable<never>

    static failure(
        error: SemanticError | SemanticError[],
    ): GeneratorFailable<never>

    static failure(
        error: SemanticError | SemanticError[],
        option: IsFatalOption,
    ): GeneratorFailable<never>

    static failure(
        errorOrMessage: string | SemanticError | SemanticError[],
        ...options:
            | []
            | [SourceCodeSpan]
            | [SourceCodeSpan, IsFatalOption]
            | [IsFatalOption]
    ): GeneratorFailable<never> {
        const isFatal = options.some((option) => 'isFatal' in option)

        if (errorOrMessage instanceof SemanticError) {
            return new GeneratorFailable<never>({
                errors: [errorOrMessage],
                isFatal,
            })
        }

        if (Array.isArray(errorOrMessage)) {
            return new GeneratorFailable<never>({
                errors: errorOrMessage,
                isFatal,
            })
        }

        const span = options[0]
        if (span && 'start' in span) {
            return new GeneratorFailable<never>({
                errors: [
                    SemanticError.create({
                        message: errorOrMessage,
                        span,
                    }),
                ],
                isFatal,
            })
        }

        throw new Error('Invalid arguments for Failable.failure')
    }

    isSuccess(): this is { result: { value: T } } {
        return 'value' in this.result
    }

    isFailure(): this is GeneratorFailable<never> {
        return !this.isSuccess()
    }

    value(): T {
        if ('value' in this.result) return this.result.value as T
        else throw SemanticErrorCollection.create(this.result.errors)
    }

    errors(): SemanticError[] {
        return 'errors' in this.result ? this.result.errors : []
    }

    static do<T>(generator: () => FailableGenerator<T>): GeneratorFailable<T> {
        const gen = generator()
        let generatorResult = gen.next()
        let result = generatorValue()
        const errors: SemanticError[] = []
        if (result && 'isFatal' in result) {
            errors.push(...result.errors)
            if (result.isFatal)
                return GeneratorFailable.failure(errors, { isFatal: true })
        }

        while (!generatorResult.done) {
            generatorResult = gen.next(
                result && 'value' in result ? result.value : undefined,
            )
            result = generatorValue()
            if (result && 'isFatal' in result) {
                errors.push(...result.errors)
                if (result.isFatal)
                    return GeneratorFailable.failure(errors, { isFatal: true })
            }
        }

        return errors.length
            ? GeneratorFailable.failure(errors)
            : (generatorResult.value as GeneratorFailable<T>)

        function generatorValue(): any {
            return generatorResult.value instanceof GeneratorFailable &&
                generatorResult.value !== null &&
                'result' in generatorResult.value
                ? generatorResult.value.result
                : generatorResult.value
        }
    }

    static collect<T extends unknown[]>(values: {
        [K in keyof T]: T[K] | GeneratorFailable<T[K]>
    }): GeneratorFailable<T> {
        const result: unknown[] = []
        const errors: SemanticError[] = []

        for (let i = 0; i < values.length; i++) {
            const value = values[i]
            if (value instanceof GeneratorFailable && value.isFailure())
                errors.push(...value.errors())
            else result.push(unwrap(value))
        }

        if (errors.length > 0) return GeneratorFailable.failure(errors)

        return GeneratorFailable.success(result as T)
    }

    static *map<T, U>(
        items: T[],
        generator: (item: T) => FailableGenerator<U>,
    ): FailableGenerator<U[]> {
        const results: U[] = []

        for (const item of items) {
            const result = yield* generator(item)

            if (
                result instanceof GeneratorFailable &&
                'errors' in result.result
            ) {
                return result as GeneratorFailable<never>
            }

            results.push(result as U)
        }

        return GeneratorFailable.success(results)
    }
}

function wrap<T>(result: T | GeneratorFailable<T>): GeneratorFailable<T> {
    return result instanceof GeneratorFailable
        ? result
        : GeneratorFailable.success(result)
}

function unwrap<T>(result: T | GeneratorFailable<T>): T {
    return result instanceof GeneratorFailable ? result.value() : result
}

export type FailableGenerator<T = void> = Generator<
    GeneratorFailable<unknown>,
    GeneratorFailable<T>,
    any
>
