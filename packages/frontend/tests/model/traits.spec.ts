import { TokenStream } from '@/lexer'
import { ModuleParser } from '@/parser/module-parser'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

function compile(code: string) {
    const module = ModuleParser.create({}).parse(TokenStream.read(code))
    return module.toCIR(util.newSemanticContext()) as {
        declarations: any[]
        startBlock?: any[]
    }
}

const shape = `
trait Shape {
    func area() -> integer
}
`

describe('trait and role', () => {
    it('resolves forward parents and diamond requirements and emits implied conformances', () => {
        const result = compile(`
            trait Diamond: Left, Right {}
            trait Left: Root {}
            trait Right: Root {}
            trait Root { func ping() }
            object Value: Diamond { func ping() {} }
            func use(_ value: Root) { value.ping() }
            func forward(_ value: Diamond) { use(value) }
        `)
        const value = result.declarations.find((d) => d.name === 'Value')
        expect(value.conformances.map((c: any) => c.interface.name)).toEqual([
            'Root',
            'Left',
            'Right',
            'Diamond',
        ])
        expect(
            result.declarations.find((d) => d.name === 'Diamond').methods,
        ).toHaveLength(1)
    })

    it('rejects cycles, incompatible parents and conflicting inherited signatures', () => {
        for (const code of [
            'trait A: B {} trait B: A {}',
            'trait A: Missing {}',
            'role B {} trait A: B {}',
            'trait B {} trait A: B, B {}',
            'trait A { func x() func x() }',
            'object V {} trait A { func x(_ v: ref V) } trait B { func x(_ v: isolated V) } trait C: A, B {}',
            'trait A { func x() -> integer } trait B { func x() -> truthvalue } trait C: A, B {}',
        ])
            expect(() => compile(code)).toThrow()
    })

    it('requires inherited Self methods using the concrete implementing type', () => {
        expect(() =>
            compile(`
            trait Parent { func same(_ other: Self) -> truthvalue }
            trait Child: Parent {}
            object Value: Child {
                func same(_ other: Value) => true
            }
        `),
        ).not.toThrow()
        expect(() =>
            compile(`
            trait Parent { func same(_ other: Self) -> truthvalue }
            trait Child: Parent {}
            object Value: Child {}
        `),
        ).toThrow()
    })
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

    it('adds methods and trait conformances to data and object types through extensions', () => {
        const cir = compile(`
            trait HasArea { func area() -> integer }
            data Rectangle { width: integer }
            extension Rectangle: HasArea {
                func area() => self->width
            }
            object Unit {}
            extension Unit {
                func value() => 1
            }
            func measure(_ shape: HasArea) -> integer {
                return shape.area()
            }
            func unitValue(_ unit: Unit) -> integer {
                return unit.value()
            }
        `)
        const rectangle = cir.declarations.find(
            (declaration: any) =>
                declaration.kind === 'EXTENSION_DECL' &&
                declaration.target.name === 'Rectangle',
        ) as any
        expect(rectangle.methods).toMatchObject([
            { kind: 'FUNCTION_DECL', baseName: 'area' },
        ])
        expect(rectangle.conformances).toMatchObject([
            { interface: { name: 'HasArea' } },
        ])
        const rectangleType = cir.declarations.find(
            (declaration: any) => declaration.name === 'Rectangle',
        ) as any
        expect(rectangleType).not.toHaveProperty('methods')
        expect(rectangleType).not.toHaveProperty('conformances')
        const unit = cir.declarations.find(
            (declaration: any) => declaration.name === 'Unit',
        ) as any
        const unitExtension = cir.declarations.find(
            (declaration: any) =>
                declaration.kind === 'EXTENSION_DECL' &&
                declaration.target.name === 'Unit',
        ) as any
        expect(unit.methods).toEqual([])
        expect(unitExtension.methods).toMatchObject([
            { kind: 'FUNCTION_DECL', baseName: 'value' },
        ])
        expect(JSON.stringify(cir.declarations)).toContain(
            '"dispatch":"direct"',
        )
    })

    it('rejects duplicate extension methods and conformances', () => {
        expect(() =>
            compile(`
                data Value {}
                extension Value { func read() => 1 }
                extension Value { func read() => 2 }
            `),
        ).toThrow('Duplicate extension method')
        expect(() =>
            compile(`
                trait Named { func name() -> integer }
                data Value {}
                extension Value: Named { func name() => 1 }
                extension Value: Named { func name() => 1 }
            `),
        ).toThrow('conforms to Named more than once')
        expect(() =>
            compile(`
                object Base {}
                object Child: Base { func read() => 1 }
                extension Base { func read() => 2 }
            `),
        ).toThrow('Duplicate extension method')
        expect(() =>
            compile('extension integer { func value() => self }'),
        ).toThrow('Unknown extension target integer')
        expect(() =>
            compile(`
                trait Named { func name() -> integer }
                object Value: Named { func name() => 1 }
                extension Value: Named {}
            `),
        ).toThrow('conforms to Named more than once')
    })

    it('uses static dispatch for extension methods on polymorphic types', () => {
        const cir = compile(`
            object Base {}
            object Child: Base {}
            extension Base { func describe() => 1 }
            func describe(_ value: Child) -> integer {
                return value.describe()
            }
        `)
        const base = cir.declarations.find(
            (declaration: any) => declaration.name === 'Base',
        ) as any
        const call = cir.declarations.find(
            (declaration: any) => declaration.baseName === 'describe',
        ) as any
        expect(base.dispatchTable).toEqual([])
        expect(call.body).toMatchObject([
            {
                kind: 'RETURN',
                value: {
                    kind: 'CALL',
                    receiver: { dispatch: 'direct' },
                    arguments: [],
                },
            },
        ])
        expect(call.body[0].value.receiver.object.type).toEqual({
            universe: 'rc-type',
            name: 'Base',
        })
    })

    it('allows role conformances on services through extensions', () => {
        const cir = compile(`
            role Starts { func start() }
            service Worker {}
            extension Worker: Starts { func start() {} }
        `)
        const worker = cir.declarations.find(
            (declaration: any) =>
                declaration.kind === 'EXTENSION_DECL' &&
                declaration.target.name === 'Worker',
        ) as any
        expect(worker.conformances).toMatchObject([
            { interface: { name: 'Starts' } },
        ])
        const workerType = cir.declarations.find(
            (declaration: any) => declaration.name === 'Worker',
        ) as any
        expect(workerType).not.toHaveProperty('conformances')
    })

    it('uses copy-on-write before calling a mutating data extension method', () => {
        const cir = compile(`
            data Counter { value: integer }
            extension Counter {
                mutating:
                    func increment() { self->value = self->value + 1 }
            }
            @main {
                mut counter: Counter = { value: 0 }
                counter.increment()
            }
        `)
        expect(cir.startBlock?.[1]).toMatchObject({
            kind: 'ENSURE_UNIQUE',
        })
        expect(cir.startBlock?.[2]).toMatchObject({
            kind: 'CALL',
            name: { baseName: 'increment' },
        })
    })
})
