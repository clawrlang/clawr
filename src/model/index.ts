import * as cir from '../cir'
import { ErrorReporter } from '../diagnostics'

type Context = {
    variableTypes: Map<string, string>
    errorReporter: ErrorReporter
}

export interface Expression {
    type(context: Context): string
    toCIR(context: Context): cir.Expression
}

export class TruthValueLiteral implements Expression {
    private constructor(private value: 'false' | 'ambiguous' | 'true') {}

    static create(value: 'false' | 'ambiguous' | 'true'): TruthValueLiteral {
        return new TruthValueLiteral(value)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'TRUTHVALUE_LITERAL', value: this.value }
    }

    type(_: Context): string {
        return 'truthvalue'
    }
}

export class IntegerLiteral implements Expression {
    private constructor(private value: bigint) {}

    static create(value: bigint): IntegerLiteral {
        return new IntegerLiteral(value)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'INTEGER_LITERAL', value: this.value.toString() }
    }

    type(_: Context): string {
        return 'integer'
    }
}

export class VariableReference implements Expression {
    private constructor(private name: string) {}

    static create(name: string): VariableReference {
        return new VariableReference(name)
    }

    toCIR(_: Context): cir.Expression {
        return { kind: 'VARIABLE_REF', name: this.name }
    }

    type(context: Context): string {
        const type = context.variableTypes.get(this.name)
        if (!type)
            throw new Error(
                `Variable ${this.name} is not defined in the current context`,
            )
        return type
    }
}

export interface Statement {
    toCIR(context: Context): cir.Statement
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

    toCIR(context: Context): cir.Statement {
        return {
            kind: 'CALL_FUNC',
            signature: {
                baseName:
                    this.baseName === 'print'
                        ? `print${this.args[0].value.type(context) === 'integer' ? 'Integer' : 'Truthvalue'}`
                        : this.baseName,
                parameters: this.args.map((arg, index) => ({
                    label: this.args[index].label,
                    type: arg.value.type(context),
                })),
            },
            arguments: this.args.map((arg) => arg.value.toCIR(context)),
        }
    }
}

export class VariableDeclaration implements Statement {
    private constructor(
        public semantics: 'const' | 'mut',
        public name: string,
        public type: string,
        public initialValue: Expression,
    ) {}

    static create({
        semantics,
        name,
        type,
        initialValue,
    }: {
        semantics: 'const' | 'mut'
        name: string
        type: string
        initialValue: Expression
    }): VariableDeclaration {
        return new VariableDeclaration(semantics, name, type, initialValue)
    }

    toCIR(context: Context): cir.Statement {
        context.variableTypes.set(this.name, this.type)
        return {
            kind: 'VARIABLE_DECL',
            name: this.name,
            type: this.type,
            initialValue: this.initialValue.toCIR(context),
        }
    }
}

export class Module {
    private constructor(private main: Statement[]) {}

    static create({ main }: { main: Statement[] }): Module {
        return new Module(main)
    }

    toCIR(context: Context): cir.ClawrModule {
        return {
            startBlock: this.main.map((stmt) => stmt.toCIR(context)),
        }
    }
}
