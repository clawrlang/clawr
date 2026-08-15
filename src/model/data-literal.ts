import * as cir from '../cir'
import { Context, Expression } from '.'
import { IsolationLevel, UNIQUE } from './isolation-level'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { Lattice, RCTypeLattice } from './lattice'
import { Failable } from './failable'
import { TypeName } from './type-name'

export class DataLiteral implements Expression {
    private constructor(
        private fields: FieldValue[],
        public span: SourceCodeSpan,
    ) {}

    static create({
        fields,
        span,
    }: {
        fields: FieldValue[]
        span: SourceCodeSpan
    }): DataLiteral {
        return new DataLiteral(fields, span)
    }

    isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }

    isolationLevel(_: Context): Failable<UNIQUE> {
        return Failable.success(UNIQUE)
    }

    currentValue(context: Context & { type: TypeName }): Failable<Lattice> {
        const decl = context.scope.dataDeclaration(context.type)
        if (!decl)
            return Failable.failure(
                `DataLiteral.currentValue: type ${context.type.name} not found in scope`,
                this.span,
            )
        return Failable.collect(
            this.fields.map((field) => {
                const fieldDeclaration = decl.fields.find(
                    (declaredField) => declaredField.name === field.name,
                )
                if (!fieldDeclaration)
                    return Failable.failure(
                        `DataLiteral.currentValue: field ${field.name} not found on type ${context.type.name}`,
                        this.span,
                    )
                return field.value.currentValue({
                    ...context,
                    type:
                        fieldDeclaration.valueSet.lattice instanceof
                        RCTypeLattice
                            ? fieldDeclaration.valueSet.lattice.type
                            : undefined,
                })
            }),
        ).chaining((fieldValues) =>
            Failable.success(
                RCTypeLattice.create({
                    type: decl.name,
                    fields: Object.fromEntries(
                        fieldValues.map((value, index) => [
                            this.fields[index].name,
                            value,
                        ]),
                    ),
                }),
            ),
        )
    }

    declaredValueSet(context: Context & { type: TypeName }): Failable<Lattice> {
        const decl = context.scope.dataDeclaration(context.type)
        if (!decl)
            return Failable.failure(
                `DataLiteral.declaredValueSet: type ${context.type.name} not found in scope`,
                this.span,
            )
        return Failable.success(
            RCTypeLattice.create({
                type: decl.name,
                fields: Object.fromEntries(
                    decl.fields.map((field) => [
                        field.name,
                        field.valueSet.lattice!,
                    ]),
                ),
            }),
        )
    }

    toCIRExpression(
        context: Context & {
            type: TypeName
            isolationLevel: IsolationLevel
        },
    ): Failable<cir.Expression> {
        if (!context.type)
            throw Failable.failure(
                'DataLiteral.toCIRExpression: target type not specified',
                this.span,
            ).getError()
        if (!context.isolationLevel)
            throw Failable.failure(
                'DataLiteral.toCIRExpression: target isolation level not specified',
                this.span,
            ).getError()

        const targetType = context.scope.dataDeclaration(context.type) as
            DataDeclaration | undefined
        if (!targetType)
            return Failable.failure(
                `DataLiteral.toCIRExpression: target type ${context.type.name} not found in scope`,
                this.span,
            )
        const fieldDeclarations = new Map(
            targetType.fields.map((field) => [field.name, field]),
        )
        const fieldResults = this.fields.map((field) => {
            const fieldDeclaration = fieldDeclarations.get(field.name)
            if (!fieldDeclaration)
                // Nested literals need the declared field type as their target.
                // Missing fields are rejected here so we do not propagate undefined types.
                return Failable.failure(
                    `DataLiteral.toCIRExpression: field ${field.name} not found on type ${context.type.name}`,
                    this.span,
                )
            const nestedContext = {
                ...context,
                type:
                    fieldDeclaration.valueSet.lattice instanceof RCTypeLattice
                        ? fieldDeclaration.valueSet.lattice.type
                        : undefined,
            }
            return field.value
                .toCIRExpression(nestedContext)
                .chaining((value) =>
                    Failable.success({
                        name: field.name,
                        value,
                    }),
                )
        })
        return Failable.collect(fieldResults).chaining((fields) =>
            Failable.success({
                kind: 'ALLOCATION',
                type: context.type.toCIR(),
                isolationLevel: context.isolationLevel,
                fields,
            }),
        )
    }
}

type FieldValue = {
    name: string
    value: Expression
}
