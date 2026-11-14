import { TokenStream } from '@/lexer'
import { Scope } from '@/model/scope'
import { TruthvalueSet } from '@/model/value-set'
import { ModuleParser } from '@/parser/module-parser'
import { describe, expect, it } from 'bun:test'

function compile(source: string) {
    const scope = Scope.createRoot()
    const module = ModuleParser.create({}).parse(TokenStream.read(source))
    return { cir: module.toCIR({ scope }), scope }
}

describe('if statement semantics', () => {
    it('emits branches and three-valued logical negation', () => {
        const { cir } = compile('@main { if !ambiguous {} else if true {} }')
        expect(cir.startBlock).toMatchObject([
            {
                kind: 'IF',
                condition: {
                    kind: 'NOT',
                    type: { universe: 'truthvalue', value: 'ambiguous' },
                },
                otherwise: [{ kind: 'IF' }],
            },
        ])
    })

    it('rejects non-truthvalue conditions and negation operands', () => {
        expect(() => compile('@main { if 1 {} }')).toThrow(
            'If condition requires a truthvalue',
        )
        expect(() => compile('@main { if !1 {} }')).toThrow(
            'Logical negation requires a truthvalue',
        )
    })

    it('does not leak branch bindings and widens changed outer values', () => {
        const { scope } = compile(
            '@main { mut value: truthvalue = true if ambiguous { value = false } }',
        )
        expect(scope.currentValue('value')).toMatchObject(
            TruthvalueSet.unconstrained(),
        )
        expect(() =>
            compile('@main { if true { const local = 1 } const x = local }'),
        ).toThrow('local')
    })

    it('keeps shadowed branch bindings distinct from enclosing bindings', () => {
        const { cir } = compile(
            '@main { mut value: truthvalue = true if true { const value = false } value = false }',
        )
        const branch = cir.startBlock?.[1]
        expect(branch?.kind).toBe('IF')
        if (branch?.kind !== 'IF') throw new Error('Expected IF')
        expect(branch.then[0]).toMatchObject({
            kind: 'VARIABLE_DECL',
            name: 'valueˇlocal0',
        })
        expect(cir.startBlock?.[2]).toMatchObject({
            kind: 'ASSIGN',
            target: { name: 'value' },
        })
    })

    it('does not propagate a branch-local shadow into outer value tracking', () => {
        const { scope } = compile(
            '@main { mut value: truthvalue = true if true { mut value: truthvalue = false value = ambiguous } }',
        )
        expect(scope.currentValue('value')).toMatchObject({ values: ['true'] })
    })
})
