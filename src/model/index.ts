import * as cir from '../cir'

export interface Expression {
    toCIR(): cir.Expression
}

export class TruthValueLiteral implements Expression {
    private constructor(private value: 'false' | 'ambiguous' | 'true') {}

    static create(value: 'false' | 'ambiguous' | 'true'): TruthValueLiteral {
        return new TruthValueLiteral(value)
    }

    toCIR(): cir.Expression {
        return { kind: 'TRUTHVALUE_LITERAL', value: this.value }
    }
}

export class IntegerLiteral implements Expression {
    private constructor(private value: bigint) {}

    static create(value: bigint): IntegerLiteral {
        return new IntegerLiteral(value)
    }

    toCIR(): cir.Expression {
        return { kind: 'INTEGER_LITERAL', value: this.value.toString() }
    }
}

export interface Statement {
    toCIR(): cir.Statement
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

    toCIR(): cir.Statement {
        return {
            kind: 'CALL_FUNC',
            signature: {
                baseName:
                    this.baseName === 'print'
                        ? `print${this.args[0].value.toCIR().kind === 'INTEGER_LITERAL' ? 'Integer' : 'Truthvalue'}`
                        : this.baseName,
                parameters: this.args.map((arg, index) => ({
                    label: this.args[index].label,
                    type:
                        arg.value.toCIR().kind === 'INTEGER_LITERAL'
                            ? 'integer'
                            : 'truthvalue',
                })),
            },
            arguments: this.args.map((arg) => arg.value.toCIR()),
        }
    }
}

export class Module {
    private constructor(private main: Statement[]) {}

    static create({ main }: { main: Statement[] }): Module {
        return new Module(main)
    }

    toCIR(): cir.ClawrModule {
        return {
            startBlock: this.main.map((stmt) => stmt.toCIR()),
        }
    }
}
