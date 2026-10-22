import { Context, ContextWithType, Expression } from '@/model'
import { AnyIsolationLevel, ISOLATED } from '@/model/isolation-level'
import {
    Addition,
    Comparison,
    Division,
    Exponential,
    Modulus,
    Multiplication,
    Subtraction,
} from '@/model/operators'
import { ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'
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
        return this.compute(left, right)
    }

    currentValue(context: ContextWithType): SemanticResult<ValueSet> {
        const collected = SemanticResult.collect([
            this.left.currentValue(context),
            this.right.currentValue(context),
        ])
        if (collected.isError) return collected
        const [left, right] = collected.value
        return this.compute(left, right)
    }

    toCIRExpression(context: ContextWithType): SemanticResult<cir.Expression> {
        const collected = SemanticResult.collect([
            this.left.toCIRExpression(context),
            this.right.toCIRExpression(context),
            this.type(context),
        ])
        if (collected.isError) return collected
        const [left, right, type] = collected.value
        // The operator strategies already verified the operand types.
        return Result.value({
            kind: CIR_KINDS[this.operator],
            left,
            right,
            type: type.toCIR(),
        } as cir.Expression)
    }

    private compute(left: ValueSet, right: ValueSet): SemanticResult<ValueSet> {
        const strategy = OPERATORS[this.operator]
        const result = strategy.compute(left, right)
        return result.isError
            ? SemanticErrorResult.failure(result.error.message, this.span)
            : result
    }
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
