import { describe, it, expect } from 'bun:test'
import {
    FunctionDeclaration,
    Parameter,
} from '../../../src/model/function-declaration'
import { StringValueSet } from '../../../src/model/value-set'
import { newSemanticContext, someCodeSpan } from '../../util'

describe('FunctionDeclaration', () => {
    it('converts to CIR', () => {
        const funcDecl = FunctionDeclaration.create({
            name: 'myFunction',
            parameters: [
                Parameter.create({
                    label: 'param1',
                    varName: 'x',
                    valueSet: StringValueSet.create({ span: someCodeSpan }),
                }),
            ],
            result: StringValueSet.create({ span: someCodeSpan }),
            body: [],
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
            returnValueSet: { type: 'string' },
            body: [],
        })
    })

    it('registers the function declaration in the root scope', () => {
        const funcDecl = FunctionDeclaration.create({
            name: 'myFunction',
            parameters: [],
            result: undefined,
            body: [],
        })

        const context = newSemanticContext()
        funcDecl.emitDeclaration(context)

        expect(context.scope.rootScope.declarations.has('myFunction')).toBe(
            true,
        )
        const decl = context.scope.rootScope.declarations.get(
            'myFunction',
        ) as FunctionDeclaration
        expect(decl).toBeInstanceOf(FunctionDeclaration)
        expect(decl.name).toBe('myFunction')
        expect(decl.parameters).toEqual([])
        expect(decl.result).toBeUndefined()
        expect(decl.body).toEqual([])
    })
})
