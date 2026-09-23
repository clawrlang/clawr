import * as cir from '@/cir'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/semantic-result'
import assert from 'assert'
import { Context, Declaration, Expression, Statement } from '.'
import { DataLiteral } from './data-literal'
import { DomainDeclaration } from './domain-declaration'
import { ISOLATED, IsolationLevel, UNIQUE } from './isolation-level'
import { Retain } from './retain'
import { Scope } from './scope'
import { ValueSet } from './value-set'
import { VariableReference } from './variable-reference'

export const VARIABLE_SEMANTICS = ['const', 'mut', 'ref', 'mutref'] as const
export type VariableSemantics = (typeof VARIABLE_SEMANTICS)[number]

export class VariableDeclaration implements Statement, Declaration {
    private constructor(
        private readonly isImmutable: boolean,
        private readonly name: string,
        private readonly isolationLevel: IsolationLevel,
        private readonly domain: DomainDeclaration | undefined,
        private readonly initialValue: Expression,
    ) {}

    static create({
        isImmutable,
        name,
        isolationLevel,
        domain,
        initialValue,
    }: {
        isImmutable: boolean
        name: string
        isolationLevel: IsolationLevel
        domain?: DomainDeclaration
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(
            isImmutable,
            name,
            isolationLevel,
            domain,
            initialValue,
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
        const initialValueResult = this.currentValueFromInitial(context)
        if (initialValueResult.isError) return initialValueResult
        const initialValue = initialValueResult.value
        const validityResult = this.checkValidity(initialValue, context)
        if (validityResult.isError) return validityResult

        const domain =
            this.isImmutable && this.isolationLevel === ISOLATED
                ? initialValue
                : (this.domain ?? initialValue.unconstrained())

        scope.addVariableDeclaration(this.name, {
            isImmutable: this.isImmutable,
            isolationLevel: this.isolationLevel!!,
            domain: domain,
        })
        this.setCurrentValue(context, initialValue)

        const emissionResult = this.emitCIRDeclaration(context, domain, scope)
        if (emissionResult.isError) return emissionResult

        return Result.ok
    }

    private emitCIRDeclaration(
        context: Context,
        domain: ValueSet,
        scope: Scope | Scope['rootScope'],
    ): SemanticResult {
        const valueResult = Retain.ifStorage(this.initialValue, context)
        if (valueResult.isError) return valueResult
        const value = valueResult.value

        const initialValueResult = value.toCIRExpression({
            ...context,
            explicitDomain: this.domain,
            isolationLevel: this.isolationLevel,
        })
        if (initialValueResult.isError) return initialValueResult
        const initialValue: cir.Expression = initialValueResult.value

        scope.emitted.push({
            kind: 'VARIABLE_DECL' as const,
            name: this.name,
            domain: domain.toCIR(),
            initialValue: initialValue,
        })

        if (
            this.initialValue instanceof DataLiteral &&
            this.initialValue.initializerCall
        ) {
            const initializer = this.initialValue.initializerCall.withTarget(
                VariableReference.create({ name: this.name, span: {} as any }),
            )
            initializer.emitStatement(context)
        }
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
        if (this.isolationLevel !== valueIsolationLevel)
            return SemanticErrorResult.failure(
                `Cannot assign ${valueIsolationLevel} value to ${this.isolationLevel} target`,
                this.initialValue.span,
            )
        return Result.ok
    }

    private isValidValue(currentValue: ValueSet) {
        return !this.domain || this.domain.isSupersetTo(currentValue)
    }

    private currentValueFromInitial(
        context: Context,
    ): SemanticResult<ValueSet> {
        return this.initialValue.currentValue({
            ...context,
            explicitDomain: this.domain,
        })
    }
}
