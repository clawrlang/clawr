import * as cir from '../cir'
import { ContextWithLattice, Context, Expression } from '.'
import { UNIQUE } from './isolation-level'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { Lattice, RCTypeLattice } from './lattice'
import { TypeName } from './type-name'
import { Failable, isFailure } from './failable'

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

    *isEffectivelyConst(_: Context): Failable<boolean> {
        return Failable.success(true)
    }

    *isolationLevel(_: Context): Failable<UNIQUE> {
        return Failable.success(UNIQUE)
    }

    *currentValue(context: ContextWithLattice): Failable<Lattice> {
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

        const thisspan = this.span
        const fieldValuesResult = yield* Failable.map(
            this.fields,
            function* (field) {
                const fieldDeclaration = decl.fields.find(
                    (declaredField) => declaredField.name === field.name,
                )
                if (!fieldDeclaration)
                    return Failable.failure(
                        `DataLiteral.currentValue: field ${field.name} not found on type ${explicitLattice.type.name}`,
                        thisspan,
                    )
                return yield* field.value.currentValue({
                    ...context,
                    explicitLattice: fieldDeclaration.lattice,
                })
            },
        )
        if (isFailure(fieldValuesResult)) return fieldValuesResult
        const fieldValues: Lattice[] = yield fieldValuesResult
        return Failable.success(
            RCTypeLattice.create({
                type: decl.name,
                fields: Object.fromEntries(
                    fieldValues.map((value, index) => [
                        this.fields[index].name,
                        value,
                    ]),
                ),
            }),
        )
    }

    *declaredLattice(context: Context & { type: TypeName }): Failable<Lattice> {
        const decl = context.scope.dataDeclaration(context.type)
        if (!decl)
            return Failable.failure(
                `DataLiteral.declaredLattice: type ${context.type.name} not found in scope`,
                this.span,
            )
        return Failable.success(
            RCTypeLattice.create({
                type: decl.name,
                fields: Object.fromEntries(
                    decl.fields.map((field) => [field.name, field.lattice]),
                ),
            }),
        )
    }

    *toCIRExpression(context: ContextWithLattice): Failable<cir.Expression> {
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

        const thisspan = this.span
        const fieldValuesResult = yield* Failable.map(
            this.fields,
            function* (field) {
                const fieldDeclaration = fieldDeclarations.get(field.name)
                if (!fieldDeclaration)
                    return Failable.failure(
                        `field ${field.name} not found on type ${explicitLattice.type.canonical()}`,
                        thisspan,
                    )
                const nestedContext: ContextWithLattice = {
                    ...context,
                    explicitLattice: fieldDeclaration.lattice,
                    isolationLevel: fieldDeclaration.isolationLevel,
                }
                const value: cir.Expression =
                    yield yield* field.value.toCIRExpression(nestedContext)
                return Failable.success({
                    name: field.name,
                    value,
                    lattice: value.value,
                })
            },
        )

        const fields: {
            name: string
            value: cir.Expression
            lattice: cir.Lattice
        }[] = yield fieldValuesResult
        return Failable.success({
            kind: 'ALLOCATION',
            isolationLevel: context.isolationLevel!,
            fields,
            value: {
                type: 'rc-type',
                ...explicitLattice.type.toCIR(),
            },
        } satisfies cir.Expression)
    }
}

type FieldValue = {
    name: string
    value: Expression
}
