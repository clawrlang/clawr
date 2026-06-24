import * as cir from '../cir'
import { ErrorReporter } from '../diagnostics'

type Context = {
    scope: {
        variableTypes: Map<string, string>
        declarations: Map<string, Declaration>
    }
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
        const type = context.scope.variableTypes.get(this.name)
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
    private arguments: { label?: string; value: Expression }[] = []

    private constructor(
        private baseName: string,
        args: { label?: string; value: Expression }[],
    ) {
        this.arguments = args
    }

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
                        ? `print${this.arguments[0].value.type(context) === 'integer' ? 'Int64' : 'Truthvalue'}`
                        : this.baseName,
                parameters: this.arguments.map((arg, index) => ({
                    label: this.arguments[index].label,
                    type: arg.value.type(context),
                })),
            },
            arguments: this.arguments.map((arg) => arg.value.toCIR(context)),
        }
    }
}

export class VariableDeclaration implements Statement {
    private constructor(
        private semantics: 'const' | 'mut',
        private name: string,
        private type: string,
        private initialValue: Expression,
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
        context.scope.variableTypes.set(this.name, this.type)
        return {
            kind: 'VARIABLE_DECL',
            name: this.name,
            type: this.type,
            initialValue: this.initialValue.toCIR(context),
        }
    }
}

export class Module {
    private constructor(
        private main: Statement[],
        private declarations: Declaration[],
    ) {}

    static create({
        main,
        declarations,
    }: {
        main?: Statement[]
        declarations?: Declaration[]
    }): Module {
        return new Module(main ?? [], declarations ?? [])
    }

    toCIR(context: Context): cir.ClawrModule {
        this.declarations.forEach((decl) => {
            if (decl instanceof DataDeclaration) {
                context.scope.declarations.set(decl.name, decl)
            }
        })
        return {
            declarations: this.declarations.map((decl) => {
                if (decl instanceof DataDeclaration) {
                    return decl.toCIR(context)
                } else {
                    throw new Error('Unknown declaration type')
                }
            }),
            startBlock: this.main.map((stmt) => stmt.toCIR(context)),
        }
    }
}

export type Declaration = VariableDeclaration | DataDeclaration

type DataField = {
    name: string
    type: string
}

export class DataDeclaration {
    private constructor(
        public name: string,
        public fields: DataField[],
    ) {}

    static create({
        name,
        fields,
    }: {
        name: string
        fields: DataField[]
    }): DataDeclaration {
        return new DataDeclaration(name, fields)
    }

    toCIR(_: Context): cir.Declaration {
        return {
            kind: 'DATA_DECL',
            name: this.name,
            fields: this.fields.map((field) => ({
                name: field.name,
                type: field.type,
            })),
        }
    }
}

type FieldValue = {
    name: string
    value: Expression
}

export class DataLiteral implements Expression {
    fields: FieldValue[] = []

    constructor(fields: FieldValue[]) {
        this.fields = fields
    }

    type(_: Context): string {
        throw new Error('not implemented')
    }

    toCIR(context: Context): cir.Expression {
        return {
            kind: 'DATA_LITERAL',
            fields: this.fields.map((field) => ({
                name: field.name,
                value: field.value.toCIR(context),
            })),
        }
    }
}

export class FieldLookupExpression implements Expression {
    private constructor(
        private object: Expression,
        private field: string,
    ) {}

    static create({
        object,
        field,
    }: {
        object: Expression
        field: string
    }): FieldLookupExpression {
        return new FieldLookupExpression(object, field)
    }

    type(context: Context): string {
        const objectType = this.object.type(context)
        const declaration = context.scope.declarations.get(objectType)
        if (!declaration) {
            throw new Error(
                `Type ${objectType} is not defined in the current context`,
            )
        }
        if (!(declaration instanceof DataDeclaration)) {
            throw new Error(
                `Type ${objectType} is not a data type, cannot access fields`,
            )
        }
        const field = declaration.fields.find((f) => f.name === this.field)
        if (!field) {
            throw new Error(
                `Field ${this.field} does not exist on type ${objectType}`,
            )
        }
        return field.type
    }

    toCIR(context: Context): cir.Expression {
        return {
            kind: 'FIELD_LOOKUP',
            object: this.object.toCIR(context),
            field: this.field,
        }
    }
}
