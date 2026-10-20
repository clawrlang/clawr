import { FunctionCall } from '@/model/function-call'
import { FunctionDeclaration } from '@/model/function-declaration'
import { ISOLATED } from '@/model/isolation-level'
import { ObjectDeclaration } from '@/model/object-declaration'
import { IntegerSet, RCTypeSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

function method(
    name: string,
    value: number,
    resultType: IntegerSet<any, any> = IntegerSet.unconstrained(),
) {
    return FunctionDeclaration.create({
        baseName: name,
        parameters: [],
        implementation: {
            kind: 'implicit-return',
            expression: util.integerLiteral(value),
        },
        result: {
            isolationLevel: ISOLATED,
            type: util.spannedTypeConstraint(resultType),
        },
    })
}

function object(
    name: string,
    config: Partial<Parameters<typeof ObjectDeclaration.create>[0]> = {},
) {
    return ObjectDeclaration.create({
        ...util.someObjectDeclConfig,
        name: util.simpleTypeName(name),
        ...config,
    })
}

function emitted(context: ReturnType<typeof util.newSemanticContext>) {
    return context.scope.rootScope.emitted as any[]
}

describe('Inheritance', () => {
    it('emits base and dispatch tables for sub- and supertypes', () => {
        const context = util.newSemanticContext()
        const declarations = [
            object('Super', { readonly: [method('f', 1)] }),
            object('Sub', {
                superType: 'Super',
                readonly: [method('f', 2), method('g', 3)],
            }),
        ]
        declarations.forEach((d) => d.registerDeclaration(context))
        for (const d of declarations) {
            const result = d.emitDeclaration(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()
        }

        const [superDecl, subDecl] = emitted(context)
        expect(superDecl.base).toBeUndefined()
        expect(superDecl.dispatchTable).toMatchObject([
            {
                slot: { baseName: 'f' },
                declaredIn: { name: 'Super' },
                implementation: { name: 'Super' },
            },
        ])
        expect(subDecl.base).toMatchObject({ name: 'Super' })
        expect(subDecl.dispatchTable).toMatchObject([
            {
                slot: { baseName: 'f' },
                declaredIn: { name: 'Super' },
                implementation: { name: 'Sub' },
            },
            {
                slot: { baseName: 'g' },
                declaredIn: { name: 'Sub' },
                implementation: { name: 'Sub' },
            },
        ])
    })

    it('keeps the supertype implementation when not overridden', () => {
        const context = util.newSemanticContext()
        const declarations = [
            object('Super', { readonly: [method('f', 1)] }),
            object('Sub', { superType: 'Super' }),
        ]
        declarations.forEach((d) => d.registerDeclaration(context))
        declarations.forEach((d) => d.emitDeclaration(context))

        expect(emitted(context)[1].dispatchTable).toMatchObject([
            { implementation: { name: 'Super' } },
        ])
    })

    it('allows private properties with the same name in sub- and supertype', () => {
        const property = {
            ...util.somePropertyDeclConfig,
            isImmutable: true,
            name: 'property',
        }
        const context = util.newSemanticContext()
        const declarations = [
            object('Super', { properties: [property] }),
            object('Sub', { superType: 'Super', properties: [property] }),
        ]
        declarations.forEach((d) => d.registerDeclaration(context))
        for (const d of declarations) {
            const result = d.emitDeclaration(context)
            expect(result.isSuccess || result.error.errors).toBeTrue()
        }
        const [superDecl, subDecl] = emitted(context)
        expect(superDecl.properties).toHaveLength(1)
        expect(subDecl.properties).toHaveLength(1)
    })

    it('rejects an override with another signature', () => {
        const context = util.newSemanticContext()
        const declarations = [
            object('Super', { readonly: [method('f', 1)] }),
            object('Sub', {
                superType: 'Super',
                readonly: [method('f', 2, IntegerSet.singleton(2n))],
            }),
        ]
        declarations.forEach((d) => d.registerDeclaration(context))
        expect(declarations[0].emitDeclaration(context).isSuccess).toBeTrue()
        expect(declarations[1].emitDeclaration(context).isError).toBeTrue()
    })

    it('rejects an unknown supertype', () => {
        const context = util.newSemanticContext()
        const sub = object('Sub', { superType: 'Missing' })
        sub.registerDeclaration(context)
        expect(sub.emitDeclaration(context).isError).toBeTrue()
    })

    it('dispatches inherited methods through the supertype', () => {
        const context = util.newSemanticContext()
        const declarations = [
            object('Super', { readonly: [method('f', 1)] }),
            object('Sub', { superType: 'Super' }),
        ]
        declarations.forEach((d) => d.registerDeclaration(context))
        declarations.forEach((d) => d.emitDeclaration(context))
        context.scope.addVariableDeclaration('x', {
            ...util.someIntegerVariable,
            type: RCTypeSet.create({ type: util.simpleTypeName('Sub') }),
        })

        const call = FunctionCall.create({
            baseName: 'f',
            arguments: [],
            recipient: util.variableRef('x'),
            span: util.someCodeSpan,
        })
        const result = call.toCIRExpression(context)
        expect(result.isSuccess || result.error.errors).toBeTrue()
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'CALL',
            receiver: { dispatch: 'inherited' },
        })
    })

    it('uses dynamic dispatch for a supertype that has subtypes', () => {
        const context = util.newSemanticContext()
        const declarations = [
            object('Super', { readonly: [method('f', 1)] }),
            object('Sub', { superType: 'Super' }),
        ]
        declarations.forEach((d) => d.registerDeclaration(context))
        declarations.forEach((d) => d.emitDeclaration(context))
        expect(context.scope.isBase(util.simpleTypeName('Super'))).toBeTrue()
        expect(context.scope.isBase(util.simpleTypeName('Sub'))).toBeFalse()
    })

    it('rejects a supertype initializer call without a matching supertype', () => {
        const context = util.newSemanticContext()
        const call = FunctionCall.create({
            baseName: 'new',
            recipient: util.variableRef('Other'),
            arguments: [],
            span: util.someCodeSpan,
        })
        expect(call.emitSuperInitializer(context, undefined).isError).toBeTrue()
        expect(
            call.emitSuperInitializer(context, util.simpleTypeName('Super'))
                .isError,
        ).toBeTrue()
    })
})
