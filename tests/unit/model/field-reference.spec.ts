import { describe, expect, it, test } from 'bun:test'
import { FieldReference } from '../../../src/model/field-reference'
import { VariableReference } from '../../../src/model/variable-reference'
import { newSemanticContext, someCodeSpan } from '../../util'
import { DataDeclaration } from '../../../src/model/data-declaration'

describe('Field Reference', () => {
    it('infers its type from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'const',
            type: 'MyType',
        })
        context.scope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [{ name: 'myField', type: 'integer' }],
            }),
        )

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'myField',
            fieldSpan: someCodeSpan,
        })
        expect(fieldRef.valueSet(context).type).toBe('integer')
    })

    it('infers its isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'const',
            type: 'MyType',
        })
        context.scope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [{ name: 'myField', type: 'integer' }],
            }),
        )

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'myField',
            fieldSpan: someCodeSpan,
        })
        expect(fieldRef.semantics(context)).toBe('COW')
    })

    it('infers its type and isolation level from the context', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'mutref',
            type: 'MyType',
        })
        context.scope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [{ name: 'myField', type: 'integer' }],
            }),
        )

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'myField',
            fieldSpan: someCodeSpan,
        })
        expect(fieldRef.valueSet(context).type).toBe('integer')
        expect(fieldRef.semantics(context)).toBe('COW')
    })

    it('throws if the field does not exist on the type', () => {
        const context = newSemanticContext()
        context.scope.variables.set('myVar', {
            semantics: 'const',
            type: 'MyType',
        })
        context.scope.declarations.set(
            'MyType',
            DataDeclaration.create({
                name: 'MyType',
                fields: [{ name: 'myField', type: 'integer' }],
            }),
        )

        const fieldRef = FieldReference.create({
            object: VariableReference.create({
                name: 'myVar',
                span: someCodeSpan,
            }),
            operator: '.',
            field: 'nonExistentField',
            fieldSpan: someCodeSpan,
        })
        expect(() => fieldRef.valueSet(context)).toThrowError(
            /Field nonExistentField does not exist on type MyType/,
        )
    })

    describe('throws if the object semantics are not compatible with the operator', () => {
        const cases = [
            { operator: '->', semantics: ['const', 'COW'] },
            { operator: '->', semantics: ['mut', 'COW'] },
            { operator: '.', semantics: ['ref', 'REF'] },
            { operator: '.', semantics: ['mutref', 'REF'] },
        ] as const

        for (const { operator, semantics } of cases) {
            test(`${semantics} with "${operator}"`, () => {
                const context = newSemanticContext()
                context.scope.variables.set('myVar', {
                    semantics: semantics[0],
                    type: 'MyType',
                })
                context.scope.declarations.set(
                    'MyType',
                    DataDeclaration.create({
                        name: 'MyType',
                        fields: [{ name: 'myField', type: 'integer' }],
                    }),
                )

                const fieldRef = FieldReference.create({
                    object: VariableReference.create({
                        name: 'myVar',
                        span: someCodeSpan,
                    }),
                    operator,
                    field: 'myField',
                    fieldSpan: {
                        start: { line: 1, column: 1 },
                        end: { line: 1, column: 10 },
                    },
                })
                expect(() => fieldRef.toCIR(context)).toThrow()
                expect(context.errorReporter).toMatchObject({
                    errors: [
                        {
                            message: `Cannot access field myField of a ${semantics[1]} type object with "${operator}" operator`,
                            location: {
                                start: { line: 1, column: 1 },
                                end: { line: 1, column: 10 },
                            },
                        },
                    ],
                })
            })
        }
    })
})
