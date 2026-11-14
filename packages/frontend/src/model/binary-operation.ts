import { Context, ContextWithType, Expression } from '@/model'
import { AnyIsolationLevel, ISOLATED, UNKNOWN } from '@/model/isolation-level'
import {
    Addition,
    Comparison,
    Division,
    Exponential,
    Modulus,
    Multiplication,
    Subtraction,
} from '@/model/operators'
import { TypeName } from '@/model/type-name'
import {
    RCTypeSet,
    TruthvalueSet,
    ValueSet,
    truthvalue,
} from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
import { FunctionCall } from './function-call'
import { Retain } from './retain'
import { VariableReference } from './variable-reference'
import { LogicalAND } from './operators/logical-and'
import { LogicalOR } from './operators/logical-or'

export class BinaryOperation implements Expression {
    private constructor(
        private readonly operator: keyof typeof OPERATORS,
        private readonly left: Expression,
        private readonly right: Expression,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        operator,
        left,
        right,
        span,
    }: {
        operator: keyof typeof OPERATORS
        left: Expression
        right: Expression
        span: SourceCodeSpan
    }): BinaryOperation {
        return new BinaryOperation(operator, left, right, span)
    }

    isEffectivelyConst(_: Context): SemanticResult<boolean> {
        return Result.true
    }

    isolationLevel(_: Context): SemanticResult<AnyIsolationLevel> {
        return Result.value(ISOLATED)
    }

    type(context: ContextWithType): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.type(context),
            this.right.type(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.compute(left, right, context)
    }

    currentValue(context: ContextWithType): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.currentValue(context),
            this.right.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.compute(left, right, context)
    }

    toCIRExpression(context: ContextWithType): SemanticResult<cir.Expression> {
        const collected = SemanticResult.collect([
            this.left.type(context),
            this.right.type(context),
            this.type(context),
        ])
        if (collected.isError) return collected
        const [left, right, type] = collected.value
        if (
            left instanceof RCTypeSet &&
            right instanceof RCTypeSet &&
            isTraitOperator(this.operator) &&
            type instanceof TruthvalueSet
        )
            return this.traitComparison(context, left, right, type)
        const operands = SemanticResult.collect([
            this.left.toCIRExpression(context),
            this.right.toCIRExpression(context),
        ])
        if (operands.isError) return operands
        const [leftCIR, rightCIR] = operands.value
        if (
            (this.operator === '&&' || this.operator === '||') &&
            type instanceof TruthvalueSet &&
            isTruthvalueExpression(leftCIR) &&
            isTruthvalueExpression(rightCIR)
        )
            return Result.value(
                this.shortCircuit(
                    context,
                    this.operator === '&&' ? 'AND' : 'OR',
                    leftCIR,
                    rightCIR,
                    type,
                ),
            )
        // The operator strategies already verified the operand types.
        return Result.value({
            kind: CIR_KINDS[this.operator],
            left: leftCIR,
            right: rightCIR,
            type: type.toCIR(),
        } as cir.Expression)
    }

    private shortCircuit(
        context: Context,
        kind: 'AND' | 'OR',
        left: cir.Expression & { type: { universe: 'truthvalue' } },
        right: cir.Expression & { type: { universe: 'truthvalue' } },
        type: TruthvalueSet<truthvalue[]>,
    ): cir.Expression {
        const name = context.scope.nextTempVar()
        const result = {
            kind: 'VARIABLE_REF' as const,
            name,
            type: { universe: 'truthvalue' as const },
        }
        return {
            kind: 'SCOPE',
            statements: [
                {
                    kind: 'VARIABLE_DECL',
                    name,
                    type: result.type,
                    initialValue: left,
                },
                {
                    kind: 'IF',
                    condition: {
                        kind: 'NOT_EQUAL',
                        left: result,
                        right: {
                            kind: 'TRUTHVALUE_LITERAL',
                            type: {
                                universe: 'truthvalue',
                                value: kind === 'AND' ? 'false' : 'true',
                            },
                        },
                        type: {
                            universe: 'truthvalue',
                            values: ['false', 'true'],
                        },
                    },
                    then: [
                        {
                            kind: 'ASSIGN',
                            target: { kind: 'VARIABLE_REF', name },
                            value: {
                                kind,
                                left: result,
                                right,
                                type: type.toCIR(),
                            },
                        },
                    ],
                },
            ],
            value: result,
            cleanup: [],
            type: type.toCIR(),
        }
    }

    private traitComparison(
        context: Context,
        leftType: RCTypeSet,
        rightType: RCTypeSet,
        type: TruthvalueSet<truthvalue[]>,
    ): SemanticResult<cir.Expression> {
        const scope = context.scope.createChildScope()
        const localContext = { ...context, scope }
        const statements: Extract<cir.Statement, { kind: 'VARIABLE_DECL' }>[] =
            []
        const refs: VariableReference[] = []
        for (const [operand, operandType] of [
            [this.left, leftType],
            [this.right, rightType],
        ] as const) {
            const retained = Retain.ifStorage(operand, context)
            if (retained.isError) return retained
            const value = retained.value.toCIRExpression(context)
            if (value.isError) return value
            const name = context.scope.nextTempVar()
            scope.addVariableDeclaration(name, {
                isImmutable: true,
                isolationLevel: UNKNOWN,
                type: operandType,
            })
            statements.push({
                kind: 'VARIABLE_DECL',
                name,
                type: operandType.toCIR(),
                initialValue: value.value,
            })
            refs.push(VariableReference.create({ name, span: operand.span }))
        }
        const [left, right] = refs
        const call = (
            name: string,
            receiver: Expression,
            argument: Expression,
        ) =>
            FunctionCall.create({
                recipient: receiver,
                baseName: name,
                arguments: [{ value: argument }],
                span: this.span,
            }).toCIRExpression(localContext)
        const reverse = this.operator === '>' || this.operator === '>='
        const equality =
            this.operator === '==' ||
            this.operator === '!=' ||
            this.operator === '<=' ||
            this.operator === '>='
                ? call('equals', left, right)
                : undefined
        if (equality?.isError) return equality
        const ordering =
            this.operator !== '==' && this.operator !== '!='
                ? call(
                      'isOrderedBefore',
                      reverse ? right : left,
                      reverse ? left : right,
                  )
                : undefined
        if (ordering?.isError) return ordering
        const equals = equality?.value
        const before = ordering?.value
        const eq = equals && isTruthvalueExpression(equals) ? equals : undefined
        const ord =
            before && isTruthvalueExpression(before) ? before : undefined
        let value: cir.Expression
        if (this.operator === '==' && eq) value = eq
        else if (this.operator === '!=' && eq)
            value = {
                kind: 'NOT_EQUAL',
                left: eq,
                right: {
                    kind: 'TRUTHVALUE_LITERAL',
                    type: { universe: 'truthvalue', value: 'true' },
                },
                type: { universe: 'truthvalue', values: ['false', 'true'] },
            }
        else if ((this.operator === '<' || this.operator === '>') && ord)
            value = ord
        else if (eq && ord)
            value = this.shortCircuit(context, 'OR', eq, ord, type)
        else
            return SemanticErrorResult.failure(
                'Comparison methods must return truthvalues',
                this.span,
            )
        return Result.value({
            kind: 'SCOPE',
            statements,
            value,
            cleanup: refs
                .map((ref) => ({
                    kind: 'RELEASE' as const,
                    object: { kind: 'VARIABLE_REF' as const, name: ref.name },
                }))
                .reverse(),
            type: type.toCIR(),
        })
    }

    private compute(
        left: ValueSet,
        right: ValueSet,
        context: Context,
    ): SemanticResult<ValueSet> {
        if (
            isTraitOperator(this.operator) &&
            (left instanceof RCTypeSet || right instanceof RCTypeSet)
        ) {
            if (
                !(left instanceof RCTypeSet && right instanceof RCTypeSet) ||
                left.type.canonical() !== right.type.canonical()
            )
                return SemanticErrorResult.failure(
                    'Comparison requires operands of the same concrete type',
                    this.span,
                )
            const object = context.scope.objectDeclaration(left.type)
            if (!object || object.isPolymorphic(context))
                return SemanticErrorResult.failure(
                    'Comparison requires a non-polymorphic concrete object type',
                    this.span,
                )
            const traits =
                this.operator === '==' || this.operator === '!='
                    ? ['Equatable']
                    : this.operator === '<' || this.operator === '>'
                      ? ['Ordered']
                      : ['Ordered', 'Equatable']
            for (const name of traits) {
                if (
                    !object.conformsTo(
                        TypeName.create({ name, namespace: 'clawr' }),
                        context,
                    )
                )
                    return SemanticErrorResult.failure(
                        `${left.toString()} must conform to clawr.${name}`,
                        this.span,
                    )
            }
            if (this.operator === '==' || this.operator === '!=')
                return Result.value(TruthvalueSet.create(['false', 'true']))
            const ordered = context.scope
                .interfaceDeclaration(
                    TypeName.create({ name: 'Ordered', namespace: 'clawr' }),
                )
                ?.methods.find(
                    (method) => method.baseName === 'isOrderedBefore',
                )
            if (!(ordered?.result instanceof TruthvalueSet))
                return SemanticErrorResult.failure(
                    'clawr.Ordered.isOrderedBefore must return a truthvalue',
                    this.span,
                )
            const mayBeAmbiguous = ordered.result.values.includes('ambiguous')
            return Result.value(
                mayBeAmbiguous
                    ? TruthvalueSet.unconstrained()
                    : TruthvalueSet.create(['false', 'true']),
            )
        }
        const strategy = OPERATORS[this.operator]
        const result = strategy.compute(left, right)
        return result.isError
            ? SemanticErrorResult.failure(result.error.message, this.span)
            : result
    }
}

function isTruthvalueExpression(
    expression: cir.Expression,
): expression is cir.Expression & {
    type: Extract<cir.ValueSet, { universe: 'truthvalue' }>
} {
    return expression.type.universe === 'truthvalue'
}

function isTraitOperator(
    operator: keyof typeof OPERATORS,
): operator is '==' | '!=' | '<' | '>' | '<=' | '>=' {
    return ['==', '!=', '<', '>', '<=', '>='].includes(operator)
}

const OPERATORS = {
    '^': Exponential.instance,
    '*': Multiplication.instance,
    '/': Division.instance,
    '%': Modulus.instance,
    '+': Addition.instance,
    '-': Subtraction.instance,
    '==': Comparison.equals,
    '!=': Comparison.doesNotEqual,
    '===': Comparison.isSame,
    '!==': Comparison.isNotSame,
    '<': Comparison.isLessThan,
    '<=': Comparison.isLessThanOrEqual,
    '>': Comparison.isGreaterThan,
    '>=': Comparison.isGreaterThanOrEqual,
    '&&': LogicalAND.instance,
    '||': LogicalOR.instance,
}

const CIR_KINDS = {
    '^': 'POWER',
    '*': 'MULTIPLICATION',
    '/': 'DIVISION',
    '%': 'REMAINDER',
    '+': 'ADDITION',
    '-': 'SUBTRACTION',
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '===': 'SAME',
    '!==': 'NOT_SAME',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    '&&': 'AND',
    '||': 'OR',
} as const satisfies Record<keyof typeof OPERATORS, cir.Expression['kind']>

export interface BinaryOperator {
    compute(left: ValueSet, right: ValueSet): Result<ValueSet>
}
