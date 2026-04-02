import { describe, expect, it } from 'bun:test'
import { CModule } from '../../src/ir'
import { codegenC } from '../../src/codegen'

describe('Codegen', () => {
    it('emits #includes', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('#include "runtime.h"')
    })

    it('emits empty function', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('int main()')
        expect(cCode.replaceAll(/\s/g, '')).toContain('intmain(){}')
    })

    it('emits empty function with parameters', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [
                        {
                            type: 'int',
                            name: 'argc',
                        },
                        {
                            type: 'char**',
                            name: 'argv',
                        },
                    ],
                    body: [],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('int main(int argc, char** argv)')
        expect(cCode.replaceAll(/\s/g, '')).toContain(
            'intmain(intargc,char**argv){}',
        )
    })

    it('emits local variable declaration', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'var-decl',
                            type: 'int',
                            name: 'x',
                            value: { kind: 'raw-expression', expression: '42' },
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('int x = 42;')
    })

    it('emits function call', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'function-call',
                            name: 'printf',
                            arguments: [
                                { kind: 'string', value: 'Hello, World!\\n' },
                            ],
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('printf("Hello, World!\\n");')
    })

    it('emits assignment to variable', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'var-decl',
                            type: 'int',
                            name: 'x',
                            value: { kind: 'raw-expression', expression: '0' },
                        },
                        {
                            kind: 'assign',
                            target: { kind: 'var-ref', name: 'x' },
                            value: { kind: 'raw-expression', expression: '42' },
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('int x = 0;')
        expect(cCode).toContain('x = 42;')
    })

    it('emits assignment to field', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'assign',
                            target: {
                                kind: 'field-reference',
                                object: { kind: 'var-ref', name: 'obj' },
                                field: 'field',
                                deref: false,
                            },
                            value: { kind: 'raw-expression', expression: '42' },
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('obj.field = 42;')
    })

    it('emits assignment to pointer field', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'assign',
                            target: {
                                kind: 'field-reference',
                                object: { kind: 'var-ref', name: 'obj' },
                                field: 'field',
                                deref: true,
                            },
                            value: { kind: 'raw-expression', expression: '42' },
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('obj->field = 42;')
    })

    it('emits return statement', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'return',
                            value: { kind: 'var-ref', name: '42' },
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('return 42;')
    })

    it('emits correct C code for truthvalue variable declaration', async () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'var-decl',
                            type: 'truthvalue_t',
                            name: 'x',
                            value: { kind: 'var-ref', name: 'c_ambiguous' },
                        },
                        {
                            kind: 'function-call',
                            name: 'printf',
                            arguments: [
                                { kind: 'string', value: '%s\\n' },
                                {
                                    kind: 'function-call',
                                    name: 'truthvalue·toCString',
                                    arguments: [{ kind: 'var-ref', name: 'x' }],
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('truthvalue_t x = c_ambiguous;')
        expect(cCode).toContain('printf("%s\\n", truthvalue·toCString(x));')
    })

    it('emits global variable declaration', () => {
        const module: CModule = {
            structs: [],
            variables: [
                {
                    kind: 'var-decl',
                    type: 'int',
                    name: 'globalVar',
                    value: { kind: 'raw-expression', expression: '42' },
                },
            ],
            functions: [],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('int globalVar = 42;')
    })

    it('emits global variable declaration with modifiers', () => {
        const module: CModule = {
            structs: [],
            variables: [
                {
                    kind: 'var-decl',
                    type: 'int',
                    name: 'globalVar',
                    value: { kind: 'raw-expression', expression: '42' },
                    modifiers: ['static', 'const'],
                },
            ],
            functions: [],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('static const int globalVar = 42;')
    })

    it('emits struct definition', () => {
        const module: CModule = {
            structs: [
                {
                    kind: 'struct',
                    name: 'Point',
                    fields: [
                        { name: 'x', type: 'int' },
                        { name: 'y', type: 'int' },
                    ],
                },
            ],
            variables: [],
            functions: [],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('typedef struct Point {')
        expect(cCode).toContain('int x;')
        expect(cCode).toContain('int y;')
        expect(cCode).toContain('} Point;')
    })

    it('emits if/else with strict truth condition expression', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'if',
                            condition: {
                                kind: 'raw-expression',
                                expression: '(x == c_true)',
                            },
                            thenBranch: [
                                {
                                    kind: 'function-call',
                                    name: 'printf',
                                    arguments: [
                                        {
                                            kind: 'string',
                                            value: 'then\\n',
                                        },
                                    ],
                                },
                            ],
                            elseBranch: [
                                {
                                    kind: 'function-call',
                                    name: 'printf',
                                    arguments: [
                                        {
                                            kind: 'string',
                                            value: 'else\\n',
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('if ((x == c_true)) {')
        expect(cCode).toContain('} else {')
    })

    it('emits while loop with continue and break', () => {
        const module: CModule = {
            structs: [],
            variables: [],
            functions: [
                {
                    kind: 'function',
                    name: 'main',
                    returnType: 'int',
                    parameters: [],
                    body: [
                        {
                            kind: 'while',
                            condition: {
                                kind: 'raw-expression',
                                expression: '(x == c_true)',
                            },
                            body: [{ kind: 'continue' }, { kind: 'break' }],
                        },
                    ],
                },
            ],
        }

        const cCode = codegenC(module)
        expect(cCode).toContain('while ((x == c_true)) {')
        expect(cCode).toContain('continue;')
        expect(cCode).toContain('break;')
    })
})
