import * as cir from '@/cir'

export class FunctionName {
    private constructor(
        private baseName: string,
        private arity: number,
        private labels: string[],
    ) {}

    static create({
        baseName,
        arity,
        labels,
    }: {
        baseName: string
        arity: number
        labels: string[]
    }): FunctionName {
        return new FunctionName(baseName, arity, labels)
    }

    toCIR(): (cir.Statement & { kind: 'CALL' })['name'] {
        return {
            baseName: this.baseName,
            labels: this.labels,
        }
    }

    toString(): string {
        const unlabels = Array(this.arity - this.labels.length).fill('_')
        const labels = [...unlabels, ...this.labels]
        return `${this.baseName}(${labels.map((l) => `${l}:`).join(',')})`
    }
}
