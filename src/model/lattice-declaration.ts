import { SourceCodeSpan } from '@/tools/diagnostics'
import { Lattice } from './lattice'

export type LatticeDeclaration = Lattice & { span: SourceCodeSpan }

export function decorateLattice<T extends object>(
    lattice: Lattice,
    ext: T,
): Lattice & T {
    const decorated = Object.create(Object.getPrototypeOf(lattice)) as Lattice &
        T
    Object.assign(decorated, lattice)
    Object.assign(decorated, ext)
    return decorated
}
