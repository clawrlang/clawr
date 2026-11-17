import { Context, Expression } from '@/model'
import { ISOLATED } from '@/model/isolation-level'
import { StringLiteral } from '@/model/literals/string-literal'
import {
    FieldSet,
    IntegerSet,
    StringSet,
    TruthvalueSet,
    ValueSet,
} from '@/model/value-set'
import { SourceCodeSpan } from '@/tools'
import { Result } from '@/tools/result'
import { SemanticErrorResult, SemanticResult } from '@/tools/source-result'
import * as cir from '@clawr/cir'

export type FieldCallName =
    | 'bitfield'
    | 'tritfield'
    | 'fieldLength'
    | 'fieldLane'
    | 'fieldSlice'
    | 'fieldConcat'
    | 'tritwiseAdjust'
    | 'tritwiseRotate'
    | 'tritwiseModulate'

export function isFieldCallName(name: string): name is FieldCallName {
    return [
        'bitfield',
        'tritfield',
        'fieldLength',
        'fieldLane',
        'fieldSlice',
        'fieldConcat',
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
        const expected =
            this.name === 'fieldSlice'
                ? 3
                : this.name.startsWith('tritwise') ||
                    this.name === 'fieldLane' ||
                    this.name === 'fieldConcat'
                  ? 2
                  : 1
        if (this.args.length !== expected)
            return SemanticErrorResult.failure(
                `${this.name} expects ${expected} argument(s)`,
                this.span,
            )
        const values = SemanticResult.collect(
            this.args.map((arg) => arg.currentValue(context)),
        )
        if (values.isError) return values
        const [first, second, third] = values.value
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
        if (this.name === 'fieldConcat') {
            if (
                !(second instanceof FieldSet) ||
                first.universe !== second.universe
            )
                return SemanticErrorResult.failure(
                    'Field concatenation requires fields of the same kind',
                    this.span,
                )
            const length =
                first.length === undefined || second.length === undefined
                    ? undefined
                    : first.length + second.length
            if (length !== undefined && !Number.isSafeInteger(length))
                return SemanticErrorResult.failure(
                    'Field length is too large',
                    this.span,
                )
            return Result.value(FieldSet.create(first.universe, length))
        }
        if (this.name === 'fieldLane' || this.name === 'fieldSlice') {
            if (
                !(second instanceof IntegerSet) ||
                (this.name === 'fieldSlice' && !(third instanceof IntegerSet))
            )
                return SemanticErrorResult.failure(
                    `${this.name} requires integer indices and counts`,
                    this.span,
                )
            const sizes =
                third instanceof IntegerSet ? [second, third] : [second]
            if (sizes.some((size) => size.max !== undefined && size.max < 0n))
                return SemanticErrorResult.failure(
                    'Field index or count cannot be negative',
                    this.span,
                )
            if (first.length !== undefined) {
                const length = BigInt(first.length)
                const start =
                    second.min === undefined || second.min < 0n
                        ? 0n
                        : second.min
                const count =
                    this.name === 'fieldLane'
                        ? 1n
                        : third instanceof IntegerSet &&
                            third.min !== undefined &&
                            third.min > 0n
                          ? third.min
                          : 0n
                if (start + count > length)
                    return SemanticErrorResult.failure(
                        this.name === 'fieldLane'
                            ? 'Field lane index is out of bounds'
                            : 'Field slice is out of bounds',
                        this.span,
                    )
            }
            if (this.name === 'fieldLane')
                return Result.value(
                    first.universe === 'bitfield'
                        ? TruthvalueSet.create(['false', 'true'])
                        : TruthvalueSet.unconstrained(),
                )
            const length =
                third instanceof IntegerSet &&
                third.min !== undefined &&
                third.min === third.max &&
                third.min >= 0n &&
                third.min <= BigInt(Number.MAX_SAFE_INTEGER)
                    ? Number(third.min)
                    : undefined
            return Result.value(FieldSet.create(first.universe, length))
        }
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
        const [first, second, third] = args.value
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
        if (this.name === 'fieldLane' || this.name === 'fieldSlice') {
            if (second?.type.universe !== 'integer')
                return SemanticErrorResult.failure(
                    'Expected integer index',
                    this.span,
                )
            const index = second as cir.Expression & {
                type: { universe: 'integer' }
            }
            if (
                this.name === 'fieldLane' &&
                result.value instanceof TruthvalueSet
            )
                return Result.value({
                    kind: 'FIELD_LANE',
                    operand,
                    index,
                    type: result.value.toCIR(),
                })
            if (
                third?.type.universe !== 'integer' ||
                !(result.value instanceof FieldSet)
            )
                return SemanticErrorResult.failure(
                    'Expected integer length',
                    this.span,
                )
            return Result.value({
                kind: 'FIELD_SLICE',
                operand,
                start: index,
                length: third as cir.Expression & {
                    type: { universe: 'integer' }
                },
                type: result.value.toCIR(),
            })
        }
        if (this.name === 'fieldConcat') {
            if (
                !(result.value instanceof FieldSet) ||
                !second ||
                (second.type.universe !== 'bitfield' &&
                    second.type.universe !== 'tritfield')
            )
                return SemanticErrorResult.failure('Expected fields', this.span)
            return Result.value({
                kind: 'FIELD_CONCAT',
                left: operand,
                right: second as cir.Expression & { type: cir.FieldSet },
                type: result.value.toCIR(),
            })
        }
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
