import * as cir from '../cir'

export interface Expression {
    toCir(): cir.Expression
}

export class TruthValueLiteral implements Expression {
    private constructor(private value: 'false' | 'ambiguous' | 'true') {}

    static create(value: 'false' | 'ambiguous' | 'true'): TruthValueLiteral {
        return new TruthValueLiteral(value)
    }

    toCir(): cir.Expression {
        return { type: 'TRUTHVALUE_LITERAL', value: this.value }
    }
}

export class IntegerLiteral implements Expression {
    private constructor(private value: bigint) {}

    static create(value: bigint): IntegerLiteral {
        return new IntegerLiteral(value)
    }

    toCir(): cir.Expression {
        return { type: 'INTEGER_LITERAL', value: this.value.toString() }
    }
}

export interface Statement {
    toCir(): cir.Statement
}

export class CallFunc implements Statement {
    private constructor(
        private baseName: string,
        private args: { label?: string; value: Expression }[],
    ) {}

    static create({
        baseName,
        arguments: args,
    }: {
        baseName: string
        arguments: { label?: string; value: Expression }[]
    }): CallFunc {
        return new CallFunc(baseName, args)
    }

    toCir(): cir.Statement {
        return {
            type: 'CALL_FUNC',
            signature: {
                baseName:
                    this.baseName === 'print'
                        ? `print${this.args[0].value.toCir().type === 'INTEGER_LITERAL' ? 'Integer' : 'Truthvalue'}`
                        : this.baseName,
                parameters: this.args.map((arg, index) => ({
                    label: this.args[index].label,
                    type:
                        arg.value.toCir().type === 'INTEGER_LITERAL'
                            ? 'integer'
                            : 'truthvalue',
                })),
            },
            arguments: this.args.map((arg) => arg.value.toCir()),
        }
    }
}
