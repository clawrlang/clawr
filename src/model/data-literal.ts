import * as cir from '../cir'
import { ContextWithLattice, Context, Expression } from '.'
import { UNIQUE } from './isolation-level'
import { SourceCodeSpan } from '../diagnostics'
import { DataDeclaration } from './data-declaration'
import { Lattice, RCTypeLattice } from './lattice'
import { _Failable } from './failable'
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

    isEffectivelyConst(_: Context): _Failable<boolean> {
        return _Failable.success(true)
    }

    isolationLevel(_: Context): _Failable<UNIQUE> {
        return _Failable.success(UNIQUE)
    }

    currentValue(context: ContextWithLattice): _Failable<Lattice> {
        const explicitLattice = context.explicitLattice
        if (!(explicitLattice instanceof RCTypeLattice))
            return _Failable.failure(
                'Data Literal without explicit value set is not supported',
                this.span,
            )
        const decl = context.scope.dataDeclaration(explicitLattice.type)
        if (!decl)
            return _Failable.failure(
                `DataLiteral.currentValue: type ${explicitLattice.type.name} not found in scope`,
                this.span,
            )
        return _Failable
            .collect(
                this.fields.map((field) => {
                    const fieldDeclaration = decl.fields.find(
                        (declaredField) => declaredField.name === field.name,
                    )
                    if (!fieldDeclaration)
                        return _Failable.failure(
                            `DataLiteral.currentValue: field ${field.name} not found on type ${explicitLattice.type.name}`,
                            this.span,
                        )
                    return field.value.currentValue({
                        ...context,
                        explicitLattice: fieldDeclaration.lattice,
                    })
                }),
            )
            .chaining((fieldValues) =>
                _Failable.success(
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

    declaredLattice(context: Context & { type: TypeName }): _Failable<Lattice> {
        const decl = context.scope.dataDeclaration(context.type)
        if (!decl)
            return _Failable.failure(
                `DataLiteral.declaredLattice: type ${context.type.name} not found in scope`,
                this.span,
            )
        return _Failable.success(
            RCTypeLattice.create({
                type: decl.name,
                fields: Object.fromEntries(
                    decl.fields.map((field) => [field.name, field.lattice]),
                ),
            }),
        )
    }

    toCIRExpression(context: ContextWithLattice): _Failable<cir.Expression> {
        const explicitLattice = context.explicitLattice
        if (!(explicitLattice instanceof RCTypeLattice))
            return _Failable.failure(
                'DataLiteral.toCIRExpression: data literal without explicit type',
                this.span,
            )
        if (!context.isolationLevel)
            return _Failable.failure(
                'DataLiteral.toCIRExpression: target isolation level not specified',
                this.span,
            )

        const targetType = context.scope.dataDeclaration(
            explicitLattice.type,
        ) as DataDeclaration | undefined
        if (!targetType)
            return _Failable.failure(
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
                return _Failable.failure(
                    `DataLiteral.toCIRExpression: field ${field.name} not found on type ${explicitLattice.type.name}`,
                    this.span,
                )
            const nestedContext: ContextWithLattice = {
                ...context,
                explicitLattice: fieldDeclaration.lattice,
                isolationLevel: fieldDeclaration.isolationLevel,
            }
            return field.value
                .toCIRExpression(nestedContext)
                .chaining((value) =>
                    _Failable.success({
                        name: field.name,
                        value,
                        lattice: value.value,
                    }),
                )
        })
        return _Failable.collect(fieldResults).chaining((fields) =>
            _Failable.success({
                kind: 'ALLOCATION',
                type: explicitLattice.type.toCIR(),
                isolationLevel: context.isolationLevel!,
                fields,
                value: {
                    type: 'rc-type',
                    ...explicitLattice.type.toCIR(),
                },
            }),
        )
    }
}

type FieldValue = {
    name: string
    value: Expression
}
