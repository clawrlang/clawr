import { Context, Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { StringLiteral } from '@/model/literals/string-literal'
import { FieldSet, IntegerSet, StringSet, ValueSet } from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export type FieldCallName =
    | 'bitfield'
    | 'tritfield'
    | 'fieldLength'
    | 'tritwiseAdjust'
    | 'tritwiseRotate'
    | 'tritwiseModulate'

export function isFieldCallName(name: string): name is FieldCallName {
    return [
        'bitfield',
        'tritfield',
        'fieldLength',
        'tritwiseAdjust',
        'tritwiseRotate',
        'tritwiseModulate',
    ].includes(name)
}

export class FieldCall implements Expression {
    constructor(
        private readonly name: FieldCallName,
        private readonly args: Expression[],
        public readonly span: SourceCodeSpan,
    ) {}

    isEffectivelyConst(context: Context): SemanticResult<boolean> {
        const values = SemanticResult.collect(
            this.args.map((arg) => arg.isEffectivelyConst(context)),
        )
        return values.isError
            ? values
            : Result.value(values.value.every(Boolean))
    }

    isolationLevel() {
        return Result.value(ISOLATED)
    }

    type(context: Context): SemanticResult<ValueSet> {
        return this.currentValue(context)
    }

    currentValue(context: Context): SemanticResult<ValueSet> {
        const expected = this.name.startsWith('tritwise') ? 2 : 1
        if (this.args.length !== expected)
            return SemanticErrorResult.failure(
                `${this.name} expects ${expected} argument(s)`,
                this.span,
            )
        const values = SemanticResult.collect(
            this.args.map((arg) => arg.currentValue(context)),
        )
        if (values.isError) return values
        const [first, second] = values.value
        if (this.name === 'bitfield' || this.name === 'tritfield') {
            if (!(first instanceof StringSet))
                return SemanticErrorResult.failure(
                    `${this.name} requires a string`,
                    this.span,
                )
            const literal = this.args[0]
            if (literal instanceof StringLiteral) {
                const valid = this.name === 'bitfield' ? /^[01]*$/ : /^[T01]*$/
                if (!valid.test(literal.value))
                    return SemanticErrorResult.failure(
                        `Invalid ${this.name} lane`,
                        literal.span,
                    )
                return Result.value(
                    FieldSet.create(this.name, literal.value.length),
                )
            }
            return Result.value(FieldSet.create(this.name))
        }
        if (!(first instanceof FieldSet))
            return SemanticErrorResult.failure(
                `${this.name} requires a field`,
                this.span,
            )
        if (this.name === 'fieldLength')
            return Result.value(
                first.length === undefined
                    ? IntegerSet.range({ min: 0n })
                    : IntegerSet.singleton(BigInt(first.length)),
            )
        if (
            first.universe !== 'tritfield' ||
            !(second instanceof FieldSet) ||
            second.universe !== 'tritfield'
        )
            return SemanticErrorResult.failure(
                `${this.name} requires ternary fields`,
                this.span,
            )
        if (
            first.length !== undefined &&
            second.length !== undefined &&
            first.length !== second.length
        )
            return SemanticErrorResult.failure(
                'Field operands must have equal lengths',
                this.span,
            )
        return Result.value(
            FieldSet.create('tritfield', first.length ?? second.length),
        )
    }

    toCIRExpression(context: Context): SemanticResult<cir.Expression> {
        const result = this.currentValue(context)
        if (result.isError) return result
        const args = SemanticResult.collect(
            this.args.map((arg) => arg.toCIRExpression(context)),
        )
        if (args.isError) return args
        const [first, second] = args.value
        if (this.name === 'bitfield' || this.name === 'tritfield') {
            if (
                first.type.universe !== 'string' ||
                !(result.value instanceof FieldSet)
            )
                return SemanticErrorResult.failure(
                    'Invalid field constructor',
                    this.span,
                )
            return Result.value({
                kind: 'FIELD_FROM_STRING',
                value: first as cir.Expression & {
                    type: { universe: 'string' }
                },
                type: result.value.toCIR(),
            })
        }
        if (
            first.type.universe !== 'bitfield' &&
            first.type.universe !== 'tritfield'
        )
            return SemanticErrorResult.failure('Expected field', this.span)
        const operand = first as cir.Expression & { type: cir.FieldSet }
        if (this.name === 'fieldLength') {
            if (!(result.value instanceof IntegerSet))
                return SemanticErrorResult.failure(
                    'Invalid field length',
                    this.span,
                )
            return Result.value({
                kind: 'FIELD_LENGTH',
                operand,
                type: result.value.toCIR(),
            })
        }
        if (
            !(result.value instanceof FieldSet) ||
            !second ||
            (second.type.universe !== 'bitfield' &&
                second.type.universe !== 'tritfield')
        )
            return SemanticErrorResult.failure(
                'Expected ternary fields',
                this.span,
            )
        const kind =
            this.name === 'tritwiseAdjust'
                ? 'FIELD_ADJUST'
                : this.name === 'tritwiseRotate'
                  ? 'FIELD_ROTATE_STATES'
                  : 'FIELD_MODULATE'
        return Result.value({
            kind,
            left: operand,
            right: second as cir.Expression & { type: cir.FieldSet },
            type: result.value.toCIR(),
        })
    }
}
