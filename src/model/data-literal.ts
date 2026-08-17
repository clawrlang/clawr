import * as cir from '../cir'
import { ContextWithValueSet, Context, Expression } from '.'
import { UNIQUE } from './isolation-level'
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

    currentValue(context: ContextWithValueSet): Failable<Lattice> {
        const explicitLattice = context.explicitLattice
        if (!(explicitLattice instanceof RCTypeLattice))
            return Failable.failure(
                'Data Literal without explicit value set is not supported',
                this.span,
            )
        const decl = context.scope.dataDeclaration(explicitLattice.type)
        if (!decl)
            return Failable.failure(
                `DataLiteral.currentValue: type ${explicitLattice.type.name} not found in scope`,
                this.span,
            )
        return Failable.collect(
            this.fields.map((field) => {
                const fieldDeclaration = decl.fields.find(
                    (declaredField) => declaredField.name === field.name,
                )
                if (!fieldDeclaration)
                    return Failable.failure(
                        `DataLiteral.currentValue: field ${field.name} not found on type ${explicitLattice.type.name}`,
                        this.span,
                    )
                return field.value.currentValue({
                    ...context,
                    explicitLattice: fieldDeclaration.valueSet.lattice,
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

    toCIRExpression(context: ContextWithValueSet): Failable<cir.Expression> {
        const explicitLattice = context.explicitLattice
        if (!(explicitLattice instanceof RCTypeLattice))
            return Failable.failure(
                'DataLiteral.toCIRExpression: data literal without explicit type',
                this.span,
            )
        if (!context.isolationLevel)
            return Failable.failure(
                'DataLiteral.toCIRExpression: target isolation level not specified',
                this.span,
            )

        const targetType = context.scope.dataDeclaration(
            explicitLattice.type,
        ) as DataDeclaration | undefined
        if (!targetType)
            return Failable.failure(
                `DataLiteral.toCIRExpression: target type ${explicitLattice.type.name} not found in scope`,
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
                    `DataLiteral.toCIRExpression: field ${field.name} not found on type ${explicitLattice.type.name}`,
                    this.span,
                )
            const nestedContext: ContextWithValueSet = {
                ...context,
                explicitLattice: fieldDeclaration.valueSet.lattice,
                isolationLevel: fieldDeclaration.valueSet.isolationLevel,
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
                type: explicitLattice.type.toCIR(),
                isolationLevel: context.isolationLevel!,
                fields,
            }),
        )
    }
}

type FieldValue = {
    name: string
    value: Expression
}
