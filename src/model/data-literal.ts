import * as cir from '../cir'
import { Context, Expression } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { Lattice, UniqueTypeLattice } from './lattice'
import { Failable } from './failable'

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

    semantics(_: Context): 'UNIQUE' {
        return 'UNIQUE'
    }

    currentValue(context: Context & { typeName: string }): Failable<Lattice> {
        const DataDeclaration = context.scope.dataDeclaration(context.typeName)
        if (!DataDeclaration)
            return Failable.failure(
                `DataLiteral.currentValue: type ${context.typeName} not found in scope`,
                this.span,
            )
        return Failable.collect(
            this.fields.map((field) => {
                const fieldDeclaration = DataDeclaration.fields.find(
                    (declaredField) => declaredField.name === field.name,
                )
                if (!fieldDeclaration)
                    return Failable.failure(
                        `DataLiteral.currentValue: field ${field.name} not found on type ${context.typeName}`,
                        this.span,
                    )
                return field.value.currentValue({
                    ...context,
                    ...fieldDeclaration.valueSet,
                })
            }),
        ).map((fieldValues) =>
            Failable.success(
                UniqueTypeLattice.create({
                    typeName: DataDeclaration.name,
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

    toCIRExpression(
        context: Context & { targetValueSet: cir.ValueSet },
    ): Failable<cir.Expression> {
        const valueSet = context.targetValueSet
        if (!valueSet || valueSet.type !== 'rc-type')
            throw Failable.failure(
                `DataLiteral.toCIRExpression: target valueSet must be of type rc-type`,
                this.span,
            ).getError()

        const targetType = context.scope.dataDeclaration(valueSet.typeName) as
            DataDeclaration | undefined
        if (!targetType)
            return Failable.failure(
                `DataLiteral.toCIRExpression: target type ${valueSet.typeName} not found in scope`,
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
                    `DataLiteral.toCIRExpression: field ${field.name} not found on type ${valueSet.typeName}`,
                    this.span,
                )
            const nestedContext = {
                ...context,
                targetValueSet: fieldDeclaration.valueSet.toCIR(),
            }
            return field.value.toCIRExpression(nestedContext).map((value) =>
                Failable.success({
                    name: field.name,
                    value,
                }),
            )
        })
        return Failable.collect(fieldResults).map((fields) =>
            Failable.success({
                kind: 'ALLOCATION',
                valueSet,
                fields,
            }),
        )
    }
}

type FieldValue = {
    name: string
    value: Expression
}
