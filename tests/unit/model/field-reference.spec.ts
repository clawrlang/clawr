import { describe, expect, it } from 'bun:test'
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
            field: 'myField',
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
            field: 'myField',
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
            field: 'myField',
        })
        expect(fieldRef.valueSet(context).type).toBe('integer')
        expect(fieldRef.semantics(context)).toBe('COW')
    })
})
