import typia from 'typia'
import { ClawrModule } from '@/cir'

export default class CIRParser {
    private constructor(
        private readonly _module?: ClawrModule,
        private readonly errors?: typia.IValidation.IError[],
    ) {}

    static parse(input: string): CIRParser {
        const result = typia.validate<ClawrModule>(JSON.parse(input))

        if (result.success) return new CIRParser(result.data)
        else return new CIRParser(undefined, result.errors)
    }

    module(): ClawrModule {
        if (this.errors) {
            const details = this.errors
                .map((error) => `${error.path} expected ${error.expected}`)
                .join('; ')
            throw new Error(`Invalid CIR: ${details}`)
        } else return this._module!
    }
}
