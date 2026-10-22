import { TokenStream } from '@/lexer'
import { ModuleParser } from '@/parser/module-parser'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

function compile(code: string) {
    const module = ModuleParser.create({}).parse(TokenStream.read(code))
    return module.toCIR(util.newSemanticContext()) as { declarations: any[] }
}

const shape = `
trait Shape {
    func area() -> integer
}
`

describe('trait and role', () => {
    it('parses signatures into an interface declaration', () => {
        const cir = compile(`
            role Named {
                func rename(to name: integer) -> integer
                func ping()
            }
        `)
        expect(cir.declarations).toMatchObject([
            {
                kind: 'INTERFACE_DECL',
                name: 'Named',
                methods: [
                    {
                        baseName: 'rename',
                        labels: ['to'],
                        parameters: [{ name: 'name' }],
                    },
                    { baseName: 'ping', returnType: { universe: 'void' } },
                ],
            },
        ])
    })

    it('emits conformances for implemented requirements', () => {
        const cir = compile(`${shape}
            object Square: Shape {
                func area() => 4
            }
        `)
        const square = cir.declarations.find(
            (d) => d.kind === 'RC_TYPE_DECL',
        ) as any
        expect(square.base).toBeUndefined()
        expect(square.conformances).toEqual([
            {
                interface: { name: 'Shape' },
                fulfillments: [
                    {
                        requirement: { baseName: 'area', labels: [] },
                        implementation: { baseName: 'area', labels: [] },
                    },
                ],
            },
        ])
    })

    it('resolves a supertype followed by traits, with the trait declared last', () => {
        const cir = compile(`
            object Base { func id() => 1 }
            object Circle: Base, Shape {
                func area() => 3
            }
            ${shape}
        `)
        const circle = cir.declarations.find(
            (d: any) => d.name === 'Circle',
        ) as any
        expect(circle.base).toEqual({ name: 'Base' })
        expect(circle.conformances).toHaveLength(1)
    })

    it('accepts a method inherited from the supertype', () => {
        const cir = compile(`${shape}
            object Base { func area() => 1 }
            object Sub: Base, Shape {}
        `)
        const sub = cir.declarations.find((d: any) => d.name === 'Sub') as any
        expect(sub.conformances[0].fulfillments).toHaveLength(1)
    })

    it('inherits the conformances of the supertype', () => {
        const cir = compile(`${shape}
            object Base: Shape { func area() => 1 }
            object Sub: Base { func area() => 1 }
            object Other: Base {}
        `)
        const find = (n: string) =>
            cir.declarations.find((d: any) => d.name === n) as any
        expect(find('Sub').conformances[0].interface).toEqual({ name: 'Shape' })
        expect(find('Other').conformances[0].interface).toEqual({
            name: 'Shape',
        })
    })

    it('rejects a missing requirement', () => {
        expect(() =>
            compile(`${shape}
                object Square: Shape {}
            `),
        ).toThrow()
    })

    it('rejects a mismatching signature', () => {
        expect(() =>
            compile(`${shape}
                object Square: Shape { func area() => true }
            `),
        ).toThrow()
    })

    it('rejects a service conforming to a trait but allows a role', () => {
        expect(() =>
            compile(`${shape}
                service S: Shape { func area() => 1 }
            `),
        ).toThrow()
        expect(() =>
            compile(`role Shape { func area() -> integer }
                service S: Shape { func area() => 1 }
            `),
        ).not.toThrow()
    })

    it('rejects conforming to something that is not an interface', () => {
        expect(() =>
            compile(`
                object A {}
                object B: A, A {}
            `),
        ).toThrow()
    })

    it('calls a method on an interface-typed value using conformance dispatch', () => {
        const cir = compile(`${shape}
            func measure(_ s: Shape) -> integer {
                return s.area()
            }
        `)
        const call = JSON.stringify(cir.declarations)
        expect(call).toContain('"dispatch":"conformance"')
        expect(call).toContain('"universe":"interface"')
    })
})
