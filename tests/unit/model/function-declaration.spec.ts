import { describe, it, expect } from 'bun:test'
import {
    FunctionDeclaration,
    Parameter,
} from '../../../src/model/function-declaration'
import { IntegerValueSet, StringValueSet } from '../../../src/model/value-set'
import { newSemanticContext, someCodeSpan } from '../../util'
import { IntegerLiteral } from '../../../src/model/integer-literal'
import { ReturnStatement } from '../../../src/model/return-statement'

describe('FunctionDeclaration', () => {
    it('converts to CIR with function body', () => {
        const funcDecl = FunctionDeclaration.create({
            name: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    varName: 'x',
                    valueSet: StringValueSet.create({ span: someCodeSpan }),
                }),
            ],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.emitted[0]

        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            name: 'myFunction',
            parameters: [
                {
                    label: 'param1',
                    name: 'x',
                    valueSet: { type: 'string' },
                },
            ],
            returnValueSet: undefined,
            body: [],
        })
    })

    it('converts to CIR with implicit return', () => {
        const funcDecl = FunctionDeclaration.create({
            name: 'myFunction',
            parameters: [],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: IntegerLiteral.create({
                    value: 42n,
                    span: someCodeSpan,
                }),
            },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.emitted[0]

        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            name: 'myFunction',
            parameters: [],
            returnValueSet: { type: 'integer', min: '42', max: '42' },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: '42' },
                },
            ],
        })
    })

    it('converts to CIR with explicit result value-set', () => {
        const funcDecl = FunctionDeclaration.create({
            name: 'myFunction',
            parameters: [],
            result: IntegerValueSet.create({
                span: someCodeSpan,
            }),
            implementation: {
                kind: 'body',
                statements: [
                    ReturnStatement.create(
                        IntegerLiteral.create({
                            value: 42n,
                            span: someCodeSpan,
                        }),
                    ),
                ],
            },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        const decl = context.scope.rootScope.emitted[0]

        expect(decl).toMatchObject({
            kind: 'FUNCTION_DECL',
            name: 'myFunction',
            parameters: [],
            returnValueSet: { type: 'integer', min: undefined, max: undefined },
            body: [
                {
                    kind: 'RETURN',
                    value: { value: '42' },
                },
            ],
        })
    })

    it('registers the function declaration in the root scope', () => {
        const funcDecl = FunctionDeclaration.create({
            name: 'myFunction',
            parameters: [],
            result: undefined,
            implementation: { kind: 'body', statements: [] },
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        expect(context.scope.rootScope.declarations.has('myFunction()')).toBe(
            true,
        )
        const decl = context.scope.rootScope.declarations.get(
            'myFunction()',
        ) as FunctionDeclaration
        expect(decl).toBeInstanceOf(FunctionDeclaration)
        expect(decl.name).toBe('myFunction')
        expect(decl.parameters).toEqual([])
        expect(decl.result).toBeUndefined()
        expect(decl.implementation).toEqual({ kind: 'body', statements: [] })
    })
})
