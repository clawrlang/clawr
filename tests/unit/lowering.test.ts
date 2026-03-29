import { describe, expect, it } from 'bun:test'
import { ASTModule } from '../../src/ast'
import { lowerASTtoIR } from '../../src/ir/lowering'
import { CStatement } from '../../src/ir'

describe('Lowering Tests', () => {
    it('lowers truthvalue variable declaration as truthvalue_t', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
            ],
        }
        const module = lowerASTtoIR(program)
        expect(module.body).toMatchObject([
            {
                kind: 'var-decl',
                type: 'truthvalue_t',
                name: 'x',
                value: { kind: 'var-ref', name: 'c_ambiguous' },
            },
        ] satisfies CStatement[])
    })

    it('lowers print of truthvalue literal correctly', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'print',
                    value: { kind: 'truthvalue', value: 'true' },
                },
            ],
        }
        const module = lowerASTtoIR(program)
        expect(module.body).toMatchObject([
            {
                kind: 'function-call',
                name: 'printf',
                arguments: [
                    { kind: 'string', value: '%s\\n' },
                    {
                        kind: 'function-call',
                        name: 'truthvalue·toCString',
                        arguments: [{ kind: 'var-ref', name: 'c_true' }],
                    },
                ],
            },
        ] satisfies CStatement[])
    })

    it('lowers print of truthvalue variable correctly', () => {
        const program: ASTModule = {
            body: [
                {
                    kind: 'var-decl',
                    semantics: 'const',
                    name: 'x',
                    value: { kind: 'truthvalue', value: 'ambiguous' },
                },
                {
                    kind: 'print',
                    value: { kind: 'identifier', name: 'x' },
                },
            ],
        }
        const module = lowerASTtoIR(program)
        expect(module.body[1]).toMatchObject({
            kind: 'function-call',
            name: 'printf',
            arguments: [
                { kind: 'string', value: '%s\\n' },
                {
                    kind: 'function-call',
                    name: 'truthvalue·toCString',
                    arguments: [{ kind: 'var-ref', name: 'x' }],
                },
            ],
        } satisfies CStatement)
    })
})
