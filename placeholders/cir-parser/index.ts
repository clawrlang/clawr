/*
 * This file is replaced with generated code.
 * Changes might not apply correctly unless the /generated/cir-parser folder is first deleted.
 */

import { ClawrModule } from '@/cir'
import typia from 'typia'

export default class CIRParser {
    static parse(input: string): ClawrModule {
        const result = typia.validate<ClawrModule>(JSON.parse(input))
        if (result.success) return result.data

        const details = result.errors
            .map((error) => `${error.path} expected ${error.expected}`)
            .join('; ')
        throw new Error(`Invalid CIR: ${details}`)
    }
}
