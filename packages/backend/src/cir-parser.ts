/*
 * This file is replaced with generated code.
 * Changes might not apply correctly unless the /generated/cir-parser folder is first deleted.
 */

import { ClawrModule } from '@clawr/cir'
import { Ajv2020 } from 'ajv/dist/2020.js'
import cirSchema from '@clawr/cir/cir.schema.json' with { type: 'json' }
import YAML from 'yaml'

const validate = new Ajv2020({ allErrors: true }).compile<ClawrModule>(
    cirSchema,
)

export default class CIRParser {
    static parse(input: string): ClawrModule {
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
