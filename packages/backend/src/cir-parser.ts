/*
 * This file is replaced with generated code.
 * Changes might not apply correctly unless the /generated/cir-parser folder is first deleted.
 */

import { Module } from '@clawr/cir'
import cirSchema from '@clawr/cir/cir.schema.json' with { type: 'json' }
import declarations from '@clawr/cir/declarations.json' with { type: 'json' }
import expressions from '@clawr/cir/expressions.json' with { type: 'json' }
import statements from '@clawr/cir/statements.json' with { type: 'json' }
import valueSets from '@clawr/cir/valuesets.json' with { type: 'json' }
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
