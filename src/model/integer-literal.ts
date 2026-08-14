import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { IntegerLattice, Lattice } from './lattice'
import { Failable } from './failable'

export class IntegerLiteral implements Expression {
    get negated(): IntegerLiteral {
        return new IntegerLiteral(-this.value, this.span)
    }

    private constructor(
        public readonly value: bigint,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value: bigint
        span: SourceCodeSpan
    }): IntegerLiteral {
        return new IntegerLiteral(value, span)
    }

    isolationLevel(_: Context): Failable<'ISOLATED'> {
        return Failable.success('ISOLATED')
    }

    currentValue(_: Context): Failable<Lattice> {
        return Failable.success(
            IntegerLattice.create({ min: this.value, max: this.value }),
        )
    }

    declaredValueSet(_: Context): Failable<Lattice> {
        return Failable.success(
            IntegerLattice.create({ min: this.value, max: this.value }),
        )
    }

    toCIRExpression(_: Context): Failable<cir.Expression> {
        return Failable.success({
            kind: 'INTEGER_LITERAL',
            value: this.value.toString(),
            valueSet: {
                type: 'integer',
                min: this.value.toString(),
                max: this.value.toString(),
            },
        })
    }

    isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }
}
