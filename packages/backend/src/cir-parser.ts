import cirSchema from '@cir-schema/cir.schema.json' with { type: 'json' }
import declarations from '@cir-schema/declarations.json' with { type: 'json' }
import expressions from '@cir-schema/expressions.json' with { type: 'json' }
import statements from '@cir-schema/statements.json' with { type: 'json' }
import valueSets from '@cir-schema/valuesets.json' with { type: 'json' }
import { Module } from '@clawr/cir'
import { Ajv2020 } from 'ajv/dist/2020.js'
import YAML from 'yaml'

const validate = new Ajv2020({ allErrors: true })
    .addSchema(declarations, 'declarations.json')
    .addSchema(statements, 'statements.json')
    .addSchema(expressions, 'expressions.json')
    .addSchema(valueSets, 'valuesets.json')
    .compile<Module>(cirSchema)

export default class CIRParser {
    static parse(input: string): Module {
        const data: unknown = parse(input)
        if (validate(data)) return data

        const details = (validate.errors ?? [])
            .map((error) => `${error.instancePath || '/'} ${error.message}`)
            .join('; ')
        throw new Error(`Invalid CIR: ${details}`)
    }
}

function parse(input: string) {
    try {
        return JSON.parse(input)
    } catch {
        return YAML.parse(input)
    }
}
