import { DataDeclaration } from '@/model/data-declaration'
import { FunctionDeclaration } from '@/model/function-declaration'
import { ISOLATED } from '@/model/isolation-level'
import { IntegerLiteral } from '@/model/literals'
import { Parameter } from '@/model/parameter'
import { TypeName } from '@/model/type-name'
import { IntegerRange, RCTypeSet } from '@/model/value-set'
import { VariableDeclaration } from '@/model/variable-declaration'
import { HighlightRecorder, SemanticTokenKind } from '@/tools/highlights'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

class RecordingHighlightRecorder implements HighlightRecorder {
    recorded: { kind: SemanticTokenKind; modifiers?: string[] }[] = []

    record(kind: SemanticTokenKind, _span: unknown, modifiers?: string[]) {
        this.recorded.push({ kind, modifiers })
    }
}

describe('HighlightRecorder', () => {
    it('records a declaration for a const variable', () => {
        const highlightRecorder = new RecordingHighlightRecorder()
        const context = { ...util.newSemanticContext(), highlightRecorder }
        const decl = VariableDeclaration.create({
            isImmutable: true,
            name: 'foo',
            isolationLevel: ISOLATED,
            initialValue: IntegerLiteral.create({
                value: 1n,
                span: util.someCodeSpan,
            }),
            nameSpan: util.someCodeSpan,
            span: util.someCodeSpan,
        })

        decl.emitStatement(context)

        expect(highlightRecorder.recorded).toContainEqual({
            kind: 'variable',
            modifiers: ['declaration', 'readonly'],
        })
    })

    it('records a reference to a variable', () => {
        const highlightRecorder = new RecordingHighlightRecorder()
        const context = { ...util.newSemanticContext(), highlightRecorder }
        context.scope.addVariableDeclaration('foo', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            domain: IntegerRange.unconstrained(),
        })
        context.scope.setCurrentValue('foo', IntegerRange.unconstrained())

        util.variableRef('foo').toCIRExpression(context)

        expect(highlightRecorder.recorded).toContainEqual({
            kind: 'variable',
            modifiers: [],
        })
    })

    it('records a property access', () => {
        const highlightRecorder = new RecordingHighlightRecorder()
        const context = { ...util.newSemanticContext(), highlightRecorder }
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                properties: [
                    {
                        name: 'property',
                        isImmutable: false,
                        isolationLevel: ISOLATED,
                        domain: util.spannedDomain(
                            IntegerRange.unconstrained(),
                        ),
                    },
                ],
            }),
        )
        context.scope.addVariableDeclaration('obj', {
            isImmutable: false,
            isolationLevel: ISOLATED,
            domain: RCTypeSet.create({
                type: TypeName.create({ name: 'MyType' }),
            }),
        })
        context.scope.setCurrentValue(
            'obj',
            RCTypeSet.create({
                type: TypeName.create({ name: 'MyType' }),
                properties: {},
            }),
        )

        util.isolatedPropertyRef(
            util.variableRef('obj'),
            'property',
        ).toCIRExpression(context)

        expect(highlightRecorder.recorded).toContainEqual({
            kind: 'property',
            modifiers: [],
        })
    })

    it('records parameter declarations', () => {
        const highlightRecorder = new RecordingHighlightRecorder()
        const context = { ...util.newSemanticContext(), highlightRecorder }
        const decl = FunctionDeclaration.create({
            baseName: 'f',
            parameters: [
                Parameter.create({
                    label: undefined,
                    varName: 'x',
                    isolationLevel: ISOLATED,
                    isImmutable: true,
                    domain: util.spannedDomain(IntegerRange.unconstrained()),
                    span: util.someCodeSpan,
                }),
            ],
            result: undefined,
            implementation: {
                kind: 'implicit-return',
                expression: IntegerLiteral.create({
                    value: 1n,
                    span: util.someCodeSpan,
                }),
            },
        })

        decl.emitDeclaration(context)

        expect(highlightRecorder.recorded).toContainEqual({
            kind: 'parameter',
            modifiers: ['declaration', 'readonly'],
        })
    })
})
