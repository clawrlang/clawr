import { decimal } from 'decimalish'

export type ValueSet =
    IntegerSet | RealSet | TruthvalueSet | StringSet | RCTypeSet | InterfaceSet

export type IntegerSet = IntegerRange | IntegerSingleton

type IntegerRange<
    Min extends bigint | undefined = bigint | undefined,
    Max extends bigint | undefined = bigint | undefined,
> = {
    universe: 'integer'
    boxed?: true
} & ((Min extends undefined ? { min?: undefined } : { min: `${Min}` }) &
    (Max extends undefined ? { max?: undefined } : { max: `${Max}` }))

export type IntegerSingleton<Value extends bigint = bigint> = {
    universe: 'integer'
    boxed?: true
    value: `${Value}`
}

type RealSet = RealRange | RealSingleton

export type RealRange<
    Min extends decimal | undefined = decimal | undefined,
    Max extends decimal | undefined = decimal | undefined,
> = {
    universe: 'real'
    boxed?: true
} & (Min extends undefined ? { min?: undefined } : { min: `${Min}` }) &
    (Max extends undefined ? { max?: undefined } : { max: `${Max}` })

export type RealSingleton<Value extends decimal = decimal> = {
    universe: 'real'
    boxed?: true
    value: `${Value}`
}

type TruthvalueSet =
    | {
          universe: 'truthvalue'
          boxed?: true
      }
    | BooleanSet
    | TruthvalueSingleton

export type BooleanSet = {
    universe: 'truthvalue'
    boxed?: true
    values: ['false', 'true']
}

export type TruthvalueSingleton<Value extends truthvalue = truthvalue> = {
    universe: 'truthvalue'
    boxed?: true
    value: Value
}
export type truthvalue = 'false' | 'ambiguous' | 'true'

type StringSet = UnlimitedString | StringSingleton

type UnlimitedString = { universe: 'string' }

export type StringSingleton = { universe: 'string'; value: string }

export type RCTypeSet = {
    universe: 'rc-type'
    namespace?: string
    name: string
}

export type InterfaceSet = {
    universe: 'interface'
    namespace?: string
    name: string
}
