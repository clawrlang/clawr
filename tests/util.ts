import { Context, Expression } from '@/model'
import { decorateDomain } from '@/model/domain-declaration'
import { FieldReference } from '@/model/field-reference'
import { IntegerLiteral } from '@/model/integer-literal'
import { ISOLATED } from '@/model/isolation-level'
import { Scope } from '@/model/scope'
import { TypeName } from '@/model/type-name'
import { IntegerRange, ValueSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { ErrorReporter, SourceCodeSpan } from '@/tools/diagnostics'

export class TestErrorReporter implements ErrorReporter {
    errors: { message: string; location: SourceCodeSpan }[] = []
    warnings: { message: string; location: SourceCodeSpan }[] = []

    reportFatalError(message: string, location: SourceCodeSpan): never {
        this.reportError(message, location)
        throw new Error(message)
    }
    reportWarning(message: string, location: SourceCodeSpan): void {
        this.warnings.push({ message, location })
    }
    reportError(message: string, location: SourceCodeSpan): void {
        this.errors.push({ message, location })
    }
}
export function newSemanticContext(): Context {
    return {
        scope: Scope.createRoot(),
    } as const
}

// Structure Setup Helpers

export const someCodeSpan = {
    start: { line: 0, column: 0 },
    end: { line: 0, column: 0 },
}

export const someIntegerVariable = {
    isImmutable: false,
    isolationLevel: ISOLATED,
    domain: IntegerRange.unconstrained(),
}

export const someFieldDeclConfig = {
    name: 'someField',
    isImmutable: false,
    isolationLevel: ISOLATED,
    domain: decorateDomain(IntegerRange.unconstrained(), {
        span: someCodeSpan,
    }),
}

export const someObjectDeclConfig = {
    kind: 'object' as const,
    initializers: [],
    mutating: [],
    readonly: [],
    fields: [],
    span: someCodeSpan,
}

export function simpleTypeName(name: string) {
    return TypeName.create({ name })
}

export function variableRef(name: string) {
    return VariableReference.create({ name, span: someCodeSpan })
}

export function isolatedFieldRef(object: Expression, field: string) {
    return FieldReference.create({
        object,
        field,
        operator: '.',
        span: someCodeSpan,
        fieldSpan: someCodeSpan,
    })
}

export function sharedFieldRef(object: Expression, field: string) {
    return FieldReference.create({
        object,
        field,
        operator: '->',
        span: someCodeSpan,
        fieldSpan: someCodeSpan,
    })
}

export function integerLiteral(value: number | bigint) {
    return IntegerLiteral.create({ value: BigInt(value), span: someCodeSpan })
}

export function spannedDomain(domain: ValueSet) {
    return decorateDomain(domain, { span: someCodeSpan })
}
