import typia from 'typia'
import { ClawrModule } from '@/cir'

export const validateCIR = (input: unknown) =>
    typia.validate<ClawrModule>(input)
