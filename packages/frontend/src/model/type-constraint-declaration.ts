import { ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools/diagnostics'

export type TypeConstraintDeclaration = ValueSet & { span: SourceCodeSpan }

export function decorateTypeConstraint<T extends object>(
    type: ValueSet,
    ext: T,
): ValueSet & T {
    const decorated = Object.create(Object.getPrototypeOf(type)) as ValueSet & T
    Object.assign(decorated, type)
    Object.assign(decorated, ext)
    return decorated
}
