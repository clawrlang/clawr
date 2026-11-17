import { TokenStream } from '@/lexer'
import { FunctionName } from '@/model/function-name'
import { Scope } from '@/model/scope'
import { TypeName } from '@/model/type-name'
import { ModuleParser } from '@/parser/module-parser'
import { createStandardLibraryScope } from '@/stdlib'
import { describe, expect, it } from 'bun:test'

function compile(source: string, includeStdlib = false) {
    const scope = Scope.createRoot(createStandardLibraryScope())
    const result = ModuleParser.create({ scope })
        .parse(TokenStream.read(source))
        .toCIR({ scope })
    return {
        ...result,
        declarations: includeStdlib
            ? result.declarations
            : result.declarations?.filter(
                  (decl) =>
                      !('namespace' in decl && decl.namespace === 'clawr'),
              ),
    }
}

describe('standard library declarations', () => {
    it('resolves opaque builder calls and primitive contributions without redeclaring the runtime type', () => {
        const result = compile(`extern func text() -> string
        @main {
            const builder: HashBuilder = newHashBuilder()
            const alias = builder
            builder.add(42)
            alias.add(true)
            builder.add(1.5)
            builder.add(text())
        }`)
        expect(result.declarations).toEqual([])
        expect(result.startBlock?.[0]).toMatchObject({
            kind: 'VARIABLE_DECL',
            type: {
                universe: 'rc-type',
                namespace: 'clawr',
                name: 'HashBuilder',
            },
        })
        expect(JSON.stringify(result)).toContain('clawr')
        expect(() => compile('@main { const b: HashBuilder = {} }')).toThrow(
            'Opaque services cannot be constructed',
        )
        expect(() => compile('service Fake: HashBuilder {}')).toThrow(
            'Opaque services cannot be subclassed',
        )
        expect(() => compile('opaque service Fake {}')).toThrow(
            'Unsupported opaque service',
        )
        expect(() =>
            compile(
                '@main { const b: isolated HashBuilder = newHashBuilder() }',
            ),
        ).toThrow('Cannot assign SHARED')
        expect(() =>
            compile(
                '@main { const b = newHashBuilder() const copy = copy(of: b) }',
            ),
        ).toThrow('Opaque services cannot be copied')
        expect(() =>
            compile(`
            func forward(_ b: HashBuilder) -> HashBuilder { return b }
            @main { const b = forward(newHashBuilder()) b.add(1) }
        `),
        ).not.toThrow()
        expect(() =>
            compile('extern func wrong() -> isolated HashBuilder'),
        ).toThrow('HashBuilder results must be shared')
    })

    it('does not grant builtin HashEquatable behavior to a shadowing trait', () => {
        expect(() =>
            compile(`
            trait HashEquatable { func hash() }
            extern func consume(_ value: HashEquatable)
            @main { consume(1) }
        `),
        ).toThrow('does not conform')
    })

    it('preserves a local factory shadow without assigning its call the runtime namespace', () => {
        const result = compile(`
            extern func newHashBuilder() -> integer
            @main { const value = newHashBuilder() }
        `)
        expect(result.startBlock?.[0]).toMatchObject({
            kind: 'VARIABLE_DECL',
            type: { universe: 'integer' },
            initialValue: {
                kind: 'CALL',
                name: { baseName: 'newHashBuilder' },
            },
        })
        const statement = result.startBlock?.[0]
        if (
            statement?.kind !== 'VARIABLE_DECL' ||
            statement.initialValue.kind !== 'CALL'
        )
            throw new Error('Expected a factory call')
        expect(statement.initialValue.name.namespace).toBeUndefined()
    })
    it('registers the trait and extern function in the parent scope', () => {
        const scope = Scope.createRoot(createStandardLibraryScope())
        const trait = scope.interfaceDeclaration(
            TypeName.create({ name: 'HasStringRepresentation' }),
        )
        const print = scope.functionDeclaration(
            FunctionName.create({ baseName: 'print', arity: 1, labels: [] }),
        )
        expect(trait?.kind).toBe('trait')
        expect(trait?.methods.map((method) => method.baseName)).toEqual([
            'stringRepresentation',
        ])
        expect(print?.implementation.kind).toBe('extern')
        expect(print?.parameters[0].type?.toString()).toBe(
            'clawr¸HasStringRepresentation',
        )
        expect(trait?.name.toCIR()).toEqual({
            name: 'HasStringRepresentation',
            namespace: 'clawr',
        })
    })

    it('uses the declared print signature for calls', () => {
        const cir = compile('@main { print(42) print(true) print(1.5) }')
        expect(
            cir.startBlock?.filter((statement) => statement.kind === 'CALL'),
        ).toHaveLength(3)
        expect(() => compile('@main { print() }')).toThrow(
            'Function declaration not found: print()',
        )
        expect(() => compile('@main { print(value: 42) }')).toThrow(
            'Function declaration not found: print(value:)',
        )
        expect(() => compile('@main { print(1, 2) }')).toThrow(
            'Function declaration not found: print(_:,_:)',
        )
    })

    it('resolves truthvalue functions with their declared labels and types', () => {
        compile(`@main {
            rotate(false, by: true)
            adjust(ambiguous, towards: false)
            modulate(true, by: ambiguous)
        }`)
        expect(() => compile('@main { rotate(false, true) }')).toThrow(
            'Function declaration not found: rotate(_:,_:)',
        )
        expect(() => compile('@main { adjust(false, by: true) }')).toThrow(
            'Function declaration not found: adjust(_:,by:)',
        )
        expect(() => compile('@main { modulate(42, by: true) }')).toThrow(
            'Argument must be a truthvalue',
        )
        expect(() => compile('@main { rotate(true, by: 42) }')).toThrow(
            'Argument must be a truthvalue',
        )
        expect(() =>
            compile('@main { print(modulate(42, by: true)) }'),
        ).toThrow('Argument must be a truthvalue')
    })

    it('synthesizes ordinary Serializable extensions only for recursively pure data', () => {
        const cir = compile(`
            data Leaf { value: integer }
            data Record {
                leaf: Leaf
                flag: truthvalue
            }
            object Entity { state: id: integer }
            data WithObject { entity: Entity }
            data WithRef { shared: ref Record }
            @main {
                const record: Record = {
                    leaf: { value: 42 }
                    flag: ambiguous
                }
                serializeJSON(record)
            }
        `)
        const type = (name: string) =>
            cir.declarations?.find(
                (declaration) =>
                    declaration.kind === 'RC_TYPE_DECL' &&
                    declaration.name === name,
            )
        const extensions = cir.declarations?.filter(
            (decl) => decl.kind === 'EXTENSION_DECL',
        )
        expect(extensions?.map((decl) => decl.target.name)).toEqual([
            'Leaf',
            'Record',
        ])
        expect(extensions?.[0]).toMatchObject({
            conformances: [
                { interface: { name: 'Serializable', namespace: 'clawr' } },
            ],
            methods: [{ baseName: 'serialize', labels: ['into'] }],
        })
        expect(
            extensions?.[0]?.methods[0].body
                ?.filter((stmt) => stmt.kind === 'CALL')
                .map((stmt) => stmt.name.baseName),
        ).toEqual(['beginStructure', 'writeField', 'endStructure'])
        expect(type('Leaf')).not.toHaveProperty('methods')
        expect(type('Record')).not.toHaveProperty('conformances')
        expect(type('WithObject')).not.toHaveProperty('conformances')
        expect(type('WithRef')).not.toHaveProperty('conformances')
    })

    it('allows explicitly conforming impure data to define a serializer in an extension', () => {
        const cir = compile(`
            object Entity {}
            data Leaf { value: integer }
            data WithObject {
                entity: Entity
                shared: ref Leaf
            }
            extension WithObject: Serializable {
                func serialize(into serializer: ref Serializer) {
                    serializer.writeInteger(42)
                }
            }
            extern func value() -> WithObject
            @main { serializeJSON(value()) }
        `)
        const type = cir.declarations?.find(
            (declaration) =>
                declaration.kind === 'EXTENSION_DECL' &&
                declaration.target.name === 'WithObject',
        )
        expect(type).toMatchObject({
            conformances: [
                { interface: { name: 'Serializable', namespace: 'clawr' } },
            ],
            methods: [
                {
                    kind: 'FUNCTION_DECL',
                    baseName: 'serialize',
                    returnType: { universe: 'void' },
                },
            ],
        })
    })

    it('requires a valid extension implementation and rejects the removed custom syntax', () => {
        expect(() =>
            compile(`
                data WithoutConformance {
                    value: integer
                serialize:
                    func toJSON() -> string => text()
                }
                extern func text() -> string
            `),
        ).toThrow()
        expect(() =>
            compile(`
                object Entity {}
                data WithoutSerializer { entity: Entity }
                extension WithoutSerializer: Serializable {}
            `),
        ).toThrow('does not implement Serializable.serialize')
        expect(() =>
            compile(`
                object Entity {}
                data WrongSerializer {
                    entity: Entity
                }
                extension WrongSerializer: Serializable {
                    func serialize(into serializer: ref Serializer) -> integer => 1
                }
            `),
        ).toThrow('must not return a value')
    })

    it('includes executable Clawr stdlib code once without redeclaring opaque types', () => {
        const result = compile('@main { serializeJSON(42) }', true)
        expect(
            result.declarations?.filter(
                (decl) =>
                    decl.kind === 'RC_TYPE_DECL' &&
                    decl.name === 'JSONSerializer',
            ),
        ).toHaveLength(1)
        expect(
            result.declarations?.filter(
                (decl) =>
                    decl.kind === 'FUNCTION_DECL' &&
                    decl.baseName === 'serializeJSON',
            ),
        ).toHaveLength(1)
        expect(
            result.declarations?.some(
                (decl) =>
                    decl.kind === 'RC_TYPE_DECL' && decl.name === 'JSONBuffer',
            ),
        ).toBe(false)
    })

    it('resolves typed octet streams without exposing their runtime representation', () => {
        const module = compile(
            `
            @main {
                const input = openOctetInput("data.bin")
                const value: bitfield = readOctets(input, count: 4)
                closeOctetInput(input)
                const output = openOctetOutput("copy.bin")
                writeOctets(output, value: value)
                closeOctetOutput(output)
            }
        `,
            true,
        )
        expect(module.startBlock).toContainEqual(
            expect.objectContaining({
                kind: 'VARIABLE_DECL',
                initialValue: expect.objectContaining({
                    kind: 'CALL',
                    name: expect.objectContaining({ baseName: 'readOctets' }),
                    type: { universe: 'bitfield' },
                }),
            }),
        )
        expect(
            module.declarations?.some(
                (decl) =>
                    decl.kind === 'RC_TYPE_DECL' &&
                    ['OctetInput', 'OctetOutput'].includes(decl.name),
            ),
        ).toBe(false)
        expect(() =>
            compile('@main { const input: ref OctetInput = {} }'),
        ).toThrow()
        expect(() =>
            compile(
                '@main { const input = openOctetInput("x") const clone = copy(of: input) }',
            ),
        ).toThrow('Opaque services cannot be copied')
        expect(() =>
            compile(
                '@main { writeOctets(openOctetOutput("x"), value: tritfield("T01")) }',
            ),
        ).toThrow()
        expect(() =>
            compile('@main { readOctets(openOctetOutput("x"), count: 1) }'),
        ).toThrow()
        expect(() =>
            compile('@main { readOctets(openOctetInput("x"), count: "1") }'),
        ).toThrow()
    })

    it('uses explicit conformance instead of synthesizing a second serializer', () => {
        const result = compile(`
            data Pure { number: integer }
            extension Pure: Serializable {
                func serialize(into serializer: ref Serializer) { serializer.writeString("custom") }
            }
        `)
        expect(
            result.declarations?.filter(
                (decl) => decl.kind === 'EXTENSION_DECL',
            ),
        ).toHaveLength(1)
        expect(() =>
            compile(
                'trait Serializable {} extern func consume(_ value: Serializable) @main { consume(1) }',
            ),
        ).toThrow('does not conform')
        expect(() =>
            compile(
                'object O {} data D { value: O } extern func value() -> D @main { serializeJSON(value()) }',
            ),
        ).toThrow('does not conform')
    })

    it('transports real parameters without permitting precision-free arithmetic or storage', () => {
        const result = compile(
            'func forward(_ value: real, into serializer: ref Serializer) { serializer.writeReal(value) }',
        )
        expect(result.declarations?.[0]).toMatchObject({
            parameters: [{ type: { universe: 'real' } }, {}],
        })
        expect(() =>
            compile(
                'func wrong(_ value: real) { const result = value + value }',
            ),
        ).toThrow('explicit precision')
        expect(() => compile('data Wrong { value: real }')).toThrow(
            'explicit precision',
        )
        expect(() =>
            compile('func wrong(_ value: real) -> real { return value }'),
        ).toThrow('explicit precision')
        expect(() =>
            compile(
                'func wrong(into serializer: ref Serializer) { serializer.writeReal("wrong") }',
            ),
        ).toThrow('Argument must be a real')
        expect(() =>
            compile(
                'func wrong(into serializer: ref Serializer) { serializer.writeString(1) }',
            ),
        ).toThrow('Argument must be a string')
        expect(() =>
            compile(
                'func wrong(into serializer: ref Serializer) { serializer.writeInteger(false) }',
            ),
        ).toThrow('Argument must be an integer')
    })

    it('does not apply stdlib print boxing to a shadowing declaration', () => {
        const cir = compile(`
            extern func print(_ value: integer)
            @main { print(1) }
        `)
        expect(cir.startBlock).toMatchObject([
            { kind: 'CALL', arguments: [{ kind: 'INTEGER_LITERAL' }] },
        ])
    })

    it('checks conformance against the standard trait requirements', () => {
        const cir = compile(`
            extern func text() -> string
            object Printable: HasStringRepresentation {
                func stringRepresentation() -> string { return text() }
            }
        `)
        expect(
            cir.declarations?.find((decl) => decl.kind === 'RC_TYPE_DECL'),
        ).toMatchObject({
            kind: 'RC_TYPE_DECL',
            name: 'Printable',
            conformances: [
                {
                    interface: {
                        name: 'HasStringRepresentation',
                        namespace: 'clawr',
                    },
                    fulfillments: [
                        {
                            requirement: {
                                baseName: 'stringRepresentation',
                            },
                        },
                    ],
                },
            ],
        })
        expect(() =>
            compile('object Unprintable: HasStringRepresentation {}'),
        ).toThrow(
            'Unprintable does not implement HasStringRepresentation.stringRepresentation',
        )
        expect(() =>
            compile(`
                object Wrong: HasStringRepresentation {
                    func stringRepresentation() -> integer { return 1 }
                }
            `),
        ).toThrow('must have the same signature')
    })

    it('resolves methods on the standard trait in static analysis', () => {
        const cir = compile(`
            func stringify(_ value: HasStringRepresentation) -> string {
                return value.stringRepresentation()
            }
        `)
        const trait = {
            universe: 'interface',
            name: 'HasStringRepresentation',
            namespace: 'clawr',
        }
        expect(cir.declarations).toHaveLength(1)
        expect(cir.declarations?.[0]).toMatchObject({
            kind: 'FUNCTION_DECL',
            parameters: [{ name: 'value', type: trait }],
            body: [
                {
                    kind: 'RETURN',
                    value: {
                        kind: 'CALL',
                        receiver: {
                            dispatch: 'conformance',
                            object: {
                                kind: 'VARIABLE_REF',
                                name: 'value',
                                type: trait,
                            },
                        },
                    },
                },
            ],
        })
    })

    it('honors a forward-declared local trait without changing the stdlib signature', () => {
        const source = `
            func use(_ value: HasStringRepresentation) -> integer {
                return value.local()
            }
            object Local: HasStringRepresentation {
                func local() -> integer { return 1 }
            init:
                func new() => {}
            }
            trait HasStringRepresentation {
                func local() -> integer
            }
        `
        const cir = compile(`${source} @main { print(42) }`)
        expect(
            cir.declarations?.find((decl) => decl.kind === 'FUNCTION_DECL'),
        ).toMatchObject({
            parameters: [
                {
                    type: {
                        universe: 'interface',
                        name: 'HasStringRepresentation',
                        namespace: undefined,
                    },
                },
            ],
        })
        expect(
            cir.declarations?.find((decl) => decl.kind === 'RC_TYPE_DECL'),
        ).toMatchObject({
            conformances: [
                {
                    interface: {
                        name: 'HasStringRepresentation',
                        namespace: undefined,
                    },
                },
            ],
        })
        expect(() =>
            compile(`
                ${source}
                @main {
                    const value: Local = {Local.new()}
                    print(value)
                }
            `),
        ).toThrow('Argument does not conform to HasStringRepresentation')
    })

    it('accepts conforming objects and checks trait-typed function arguments', () => {
        expect(() =>
            compile(`
                extern func text() -> string
                object Printable: HasStringRepresentation {
                    func stringRepresentation() -> string { return text() }
                init:
                    func new() => {}
                }
                func show(_ value: HasStringRepresentation) { print(value) }
                @main {
                    const value: Printable = {Printable.new()}
                    print(value)
                    show(value)
                    show(42)
                }
            `),
        ).not.toThrow()
        expect(() =>
            compile(`
                data Record {}
                func show(_ value: HasStringRepresentation) {}
                @main {
                    const value: Record = {}
                    show(value)
                }
            `),
        ).toThrow('Argument does not conform to HasStringRepresentation')
    })

    it('rejects unsupported arguments before runtime boxing', () => {
        expect(() =>
            compile(`
                data Record {}
                @main {
                    const value: Record = {}
                    print(value)
                }
            `),
        ).toThrow('Argument does not conform to HasStringRepresentation')
    })
})
