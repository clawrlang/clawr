import * as cir from '../cir'

export class TypeName {
    private constructor(
        public name: string,
        public namespace: string | undefined,
    ) {}

    static create({ name, namespace }: { name: string; namespace?: string }) {
        return new TypeName(name, namespace)
    }

    toCIR(): cir.CanonicalName {
        return { name: this.name, namespace: this.namespace }
    }

    canonical(): string {
        return this.namespace ? `${this.namespace}¸${this.name}` : this.name
    }
}
