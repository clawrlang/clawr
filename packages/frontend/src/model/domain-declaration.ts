import { SourceCodeSpan } from '@/tools/diagnostics'
import { ValueSet } from './value-set'

export type DomainDeclaration = ValueSet & { span: SourceCodeSpan }

export function decorateDomain<T extends object>(
    domain: ValueSet,
    ext: T,
): ValueSet & T {
    const decorated = Object.create(Object.getPrototypeOf(domain)) as ValueSet &
        T
    Object.assign(decorated, domain)
    Object.assign(decorated, ext)
    return decorated
}
