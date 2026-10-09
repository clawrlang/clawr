import { DataDeclaration } from '@/model/data-declaration'
import { SHARED } from '@/model/isolation-level'
import { DataLiteral } from '@/model/literals'
import { TypeName } from '@/model/type-name'
import { RCTypeSet } from '@/model/value-set'
import * as util from '@@/util'
import { describe, expect, it } from 'bun:test'

describe('DataLiteral', () => {
    it('outputs a data literal as ALLOCATE', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: TypeName.create({ name: 'MyType' }),
                properties: [
                    { ...util.somePropertyDeclConfig, name: 'x' },
                    { ...util.somePropertyDeclConfig, name: 'y' },
                ],
            }),
        )

        const dataLiteral = DataLiteral.create({
            properties: [
                { name: 'x', value: util.integerLiteral(42) },
                { name: 'y', value: util.integerLiteral(17) },
            ],
            span: util.someCodeSpan,
        })

        const result = dataLiteral.toCIRExpression({
            ...context,
            explicitDomain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
            isolationLevel: SHARED,
        })
        expect(result.isSuccess && result.value).toMatchObject({
            kind: 'ALLOCATION',
            properties: [
                {
                    name: 'x',
                    value: {
                        kind: 'INTEGER_LITERAL',
                        value: { max: '42', min: '42' },
                    },
                },
                {
                    name: 'y',
                    value: {
                        kind: 'INTEGER_LITERAL',
                        value: { max: '17', min: '17' },
                    },
                },
            ],
        })
    })

    it('has a current value set of the literal value', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('MyType'),
                properties: [
                    { ...util.somePropertyDeclConfig, name: 'x' },
                    { ...util.somePropertyDeclConfig, name: 'y' },
                ],
            }),
        )

        const dataLiteral = DataLiteral.create({
            properties: [
                { name: 'x', value: util.integerLiteral(42) },
                { name: 'y', value: util.integerLiteral(17) },
            ],
            span: util.someCodeSpan,
        })

        const result = dataLiteral.currentValue({
            ...context,
            explicitDomain: RCTypeSet.create({
                type: util.simpleTypeName('MyType'),
            }),
        })
        expect(result.isSuccess && result.value).toMatchObject({
            type: { name: 'MyType' },
            properties: {
                x: { min: 42n, max: 42n },
                y: { min: 17n, max: 17n },
            },
        })
    })

    it('returns a failure from a nested property value', () => {
        const context = util.newSemanticContext()
        context.scope.rootScope.addDataDeclaration(
            DataDeclaration.create({
                name: util.simpleTypeName('OuterType'),
                properties: [
                    {
                        ...util.somePropertyDeclConfig,
                        name: 'inner',
                        domain: util.spannedDomain(
                            RCTypeSet.create({
                                type: util.simpleTypeName('MissingInnerType'),
                            }),
                        ),
                    },
                ],
            }),
        )

        const dataLiteral = DataLiteral.create({
            properties: [
                {
                    name: 'inner',
                    value: DataLiteral.create({
                        properties: [
                            {
                                name: 'value',
                                value: util.integerLiteral(7),
                            },
                        ],
                        span: util.someCodeSpan,
                    }),
                },
            ],
            span: util.someCodeSpan,
        })

        const result = dataLiteral.currentValue({
            ...context,
            explicitDomain: RCTypeSet.create({
                type: util.simpleTypeName('OuterType'),
            }),
        })
        expect(result.isError).toBeTrue()
    })
})
