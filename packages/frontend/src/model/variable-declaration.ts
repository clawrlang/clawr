import { Context, Declaration, Expression, Statement } from '@/model'
import { ISOLATED, IsolationLevel, UNIQUE } from '@/model/isolation-level'
import { DataLiteral } from '@/model/literals'
import { Retain } from '@/model/retain'
import { Scope } from '@/model/scope'
import { TypeConstraintDeclaration } from '@/model/type-constraint-declaration'
import { ValueSet } from '@/model/value-set'
import { VariableReference } from '@/model/variable-reference'
import { SourceCodeSpan } from '@/tools/diagnostics'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import assert from 'assert'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private readonly isImmutable: boolean,
        private readonly name: string,
        private readonly isolationLevel: IsolationLevel | undefined,
        private readonly type: TypeConstraintDeclaration | undefined,
        private readonly initialValue: Expression,
        private readonly span: SourceCodeSpan,
        private readonly nameSpan: SourceCodeSpan,
    ) {}

    static create({
        isImmutable,
        name,
        isolationLevel,
        type,
        initialValue,
        span,
        nameSpan,
    }: {
        isImmutable: boolean
        name: string
        isolationLevel?: IsolationLevel
        type?: TypeConstraintDeclaration
        initialValue: Expression
        span: SourceCodeSpan
        nameSpan: SourceCodeSpan
    }): VariableDeclaration {
        return new VariableDeclaration(
            isImmutable,
            name,
            isolationLevel,
            type,
            initialValue,
            span,
            nameSpan,
        )
    }

    emitDeclaration(context: Context): SemanticResult {
        return this.emit(context.scope.rootScope, context)
    }

    emitStatement(context: Context): SemanticResult {
        return this.emit(context.scope, context)
    }

    private emit(
        scope: Scope | Scope['rootScope'],
        context: Context,
    ): SemanticResult {
        const initialValueResult = SemanticResult.collect([
            this.initialValue.isolationLevel(context),
            this.currentValueFromInitial(context),
        ])
        if (initialValueResult.isError) return initialValueResult
        const [valueIsolationLevel, initialValue] = initialValueResult.value
        if (valueIsolationLevel === 'UNKNOWN')
            return SemanticErrorResult.failure(
                'Cannot assign UNKNOWN isolation values',
                this.span,
            )
        const validityResult = this.checkValidity(initialValue, context)
        if (validityResult.isError) return validityResult

        const type =
            this.isImmutable && this.isolationLevel === ISOLATED
                ? initialValue
                : (this.type ?? initialValue.unconstrained())

        scope.addVariableDeclaration(this.name, {
            isImmutable: this.isImmutable,
            isolationLevel:
                this.isolationLevel ??
                (valueIsolationLevel === 'UNIQUE'
                    ? ISOLATED
                    : valueIsolationLevel),
            type: type,
        })
        context.highlightRecorder?.record('variable', this.nameSpan, [
            'declaration',
            ...(this.isImmutable ? (['readonly'] as const) : []),
        ])
        this.setCurrentValue(context, initialValue)

        const emissionResult = this.emitCIRDeclaration(context, type, scope)
        if (emissionResult.isError) return emissionResult

        return Result.ok
    }

    private emitCIRDeclaration(
        context: Context,
        type: ValueSet,
        scope: Scope | Scope['rootScope'],
    ): SemanticResult {
        const valueResult = Retain.ifStorage(this.initialValue, context)
        if (valueResult.isError) return valueResult
        const value = valueResult.value

        const initialValueResult = value.toCIRExpression({
            ...context,
            explicitType: this.type,
            isolationLevel: this.isolationLevel ?? ISOLATED,
        })
        if (initialValueResult.isError) return initialValueResult
        const initialValue: cir.Expression = initialValueResult.value

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            type: type.toCIR(),
            initialValue: initialValue,
        })

        if (
            this.initialValue instanceof DataLiteral &&
            this.initialValue.initializerCall
        )
            this.initialValue.initializerCall
                .withTarget(
                    VariableReference.create({
                        name: this.name,
                        span: this.nameSpan,
                    }),
                )
                .emitStatement(context)

        return Result.ok
    }

    private setCurrentValue(context: Context, currentValue: ValueSet) {
        assert(
            context.scope.setCurrentValue(this.name, currentValue).isSuccess,
            `Setting current value for variable ${this.name} failed`,
        )
    }

    private checkValidity(
        currentValue: ValueSet,
        context: Context,
    ): SemanticResult {
        if (!this.isValidValue(currentValue))
            return SemanticErrorResult.failure(
                'Incompatible initial value',
                this.initialValue.span,
            )

        const valueIsolationLevelResult =
            this.initialValue.isolationLevel(context)
        if (valueIsolationLevelResult.isError) return valueIsolationLevelResult
        const valueIsolationLevel = valueIsolationLevelResult.value
        if (valueIsolationLevel === UNIQUE) return Result.ok
        if (!this.isolationLevel) return Result.ok
        if (this.isolationLevel !== valueIsolationLevel)
            return SemanticErrorResult.failure(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                this.initialValue.span,
            )
        return Result.ok
    }

    private isValidValue(currentValue: ValueSet) {
        return !this.type || this.type.isSupersetTo(currentValue)
    }

    private currentValueFromInitial(
        context: Context,
    ): SemanticResult<ValueSet> {
        return this.initialValue.currentValue({
            ...context,
            explicitType: this.type,
        })
    }
}
