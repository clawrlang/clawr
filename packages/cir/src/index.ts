import { decimal } from 'decimalish'
import { tags } from 'typia'

export type ClawrModule = {
    $schema: 'http://clawr.lang/schema/cir/DRAFT-0'
    startBlock?: Statement[]
    declarations?: Declaration[]
}

// ------------
// Declarations
// ------------

type InterfaceDeclaration = {
    kind: 'INTERFACE_DECL'
    name: string
    namespace?: string
    methods: FunctionSignature[]
}

type VariableDeclaration = {
    kind: 'VARIABLE_DECL'
    name: string
    namespace?: string
    domain: ValueSet
    initialValue: Expression
}

type FunctionDeclaration = {
    kind: 'FUNCTION_DECL'
    body: Statement[]
} & FunctionSignature & { namespace?: string }

type FunctionSignature = {
    baseName: string
    labels: string[]
    parameters: {
        name: string
        domain: ValueSet
    }[]
    domain?: ValueSet
}

type RCTypeDeclaration = {
    // `data` only supports these
    kind: 'RC_TYPE_DECL'
    name: string
    namespace?: string
    properties: {
        name: string
        domain: ValueSet
    }[]
    conformances?: {
        interface: CanonicalName
        fulfillments: {
            requirement: FunctionName
            implementation: FunctionName
        }[]
    }[]
} & ( // `object`/`service` add methods and initializers
    | {
          base?: CanonicalName
          methods: FunctionDeclaration[]
          initializers: (FunctionDeclaration & { domain?: undefined })[]
          dispatchTable?: {
              slot: FunctionSignature
              declaredIn: CanonicalName
              implementation?: CanonicalName
          }[]
      }
    | {}
)

export type CanonicalName = { name: string; namespace?: string }

type FunctionName = {
    baseName: string
    labels: string[]
}

export type Declaration =
    | VariableDeclaration
    | FunctionDeclaration
    | RCTypeDeclaration
    | InterfaceDeclaration

// ----------
// Statements
// ----------

type EnsureUnique = {
    kind: 'ENSURE_UNIQUE'
    object: Storage
}

type Release = {
    kind: 'RELEASE'
    object: Storage
}

type Receiver =
    | {
          object: Expression & { domain: RCTypeSet | InterfaceSet }
          dispatch: 'direct'
      }
    | {
          object: Expression & { domain: RCTypeSet }
          dispatch: 'inherited'
      }
    | {
          object: Expression & { domain: InterfaceDeclaration }
          dispatch: 'conformance'
      }

type FunctionCall = {
    kind: 'CALL'
    receiver?: Receiver
    name: FunctionName & { namespace?: string }
    arguments: Expression[]
}

type Return = {
    kind: 'RETURN'
    value?: Expression
}

type Assign = {
    kind: 'ASSIGN'
    target: Storage
    value: Expression
}

type SelfAssign = {
    kind: 'SELF_ASSIGN'
    value: Omit<MemoryAllocation, 'kind' | 'isolationLevel'> & { kind: 'DATA' }
}

export type Statement =
    | EnsureUnique
    | Release
    | FunctionCall
    | Return
    | VariableDeclaration
    | Assign
    | SelfAssign

type Storage =
    Omit<VariableReference, 'domain'> | Omit<PropertyReference, 'domain'>

// -----------
// Expressions
// -----------

type StringLiteral = {
    kind: 'STRING_LITERAL'
    domain: StringSet & { value: string }
}

type IntegerLiteral<Value extends bigint = bigint> = {
    kind: 'INTEGER_LITERAL'
    domain: IntegerRange<Value, Value>
}

type TruthvalueLiteral<Value extends truthvalue = truthvalue> = {
    kind: 'TRUTHVALUE_LITERAL'
    domain: TruthvalueSet<[Value]>
}

type MemoryAllocation = {
    kind: 'ALLOCATION'
    isolationLevel: IsolationLevel
    properties?: {
        name: string
        value: Expression
    }[]
    domain: RCTypeSet
}

type MemoryRetention = {
    kind: 'RETAIN'
    object: Storage
    domain: RCTypeSet
}

type AsShared = {
    kind: 'AS_SHARED'
    object: FunctionCall & Expression
    domain: RCTypeSet
}

type Box = {
    kind: 'BOX'
    expression: Expression
    domain: ValueSet & { boxed: true }
}

type VariableReference = {
    kind: 'VARIABLE_REF'
    name: string
    domain: ValueSet
}

type PropertyReference = {
    kind: 'PROPERTY_REF'
    object: Expression
    property: string
    domain: ValueSet
}

export type Expression =
    | StringLiteral
    | IntegerLiteral
    | TruthvalueLiteral
    | MemoryAllocation
    | MemoryRetention
    | AsShared
    | Box
    | VariableReference
    | PropertyReference
    | (FunctionCall & { domain: ValueSet })

// ---------
// ValueSets
// ---------

type IntegerRange<
    Min extends bigint | undefined = bigint | undefined,
    Max extends bigint | undefined = bigint | undefined,
> = {
    type: 'integer'
    boxed?: true
} & (Min extends undefined
    ? { min?: undefined }
    : { min: `${Min}` & tags.Pattern<'^-?\\d+$'> }) &
    (Max extends undefined
        ? { max?: undefined }
        : { max: `${Max}` & tags.Pattern<'^-?\\d+$'> })

type RealRange<
    Min extends decimal | undefined = decimal | undefined,
    Max extends decimal | undefined = decimal | undefined,
> = {
    type: 'real'
    boxed?: true
} & (Min extends undefined
    ? { min?: undefined }
    : { min: `${Min}` & tags.Pattern<'^-?\\d+\.\\d+$'> }) &
    (Max extends undefined
        ? { max?: undefined }
        : { max: `${Max}` & tags.Pattern<'^-?\\d+\.\\d+$'> })

type TruthvalueSet<Values extends truthvalue[] = truthvalue[]> = {
    type: 'truthvalue'
    boxed?: true
    values: Values
}

type StringSet = { type: 'string'; value?: string }

type RCTypeSet = {
    type: 'rc-type'
    namespace?: string
    name: string
}

type InterfaceSet = {
    type: 'interface'
    namespace?: string
    name: string
}

export type ValueSet =
    | IntegerRange
    | RealRange
    | TruthvalueSet
    | StringSet
    | RCTypeSet
    | InterfaceSet

type IsolationLevel = 'ISOLATED' | 'SHARED'
type truthvalue = 'false' | 'ambiguous' | 'true'
