import { Context, Expression, Statement } from '.'
import { SourceCodeSpan } from '../diagnostics'
import { _Failable } from './failable'
import { Retain } from './retain'

export class ReturnStatement implements Statement {
    private constructor(
        public readonly value: Expression | undefined,
        public readonly span: SourceCodeSpan,
    ) {}

    static create({
        value,
        span,
    }: {
        value?: Expression
        span: SourceCodeSpan
    }): ReturnStatement {
        return new ReturnStatement(value, span)
    }

    _emitStatement(context: Context) {
        _Failable
            .pipe(this.validateInput(context), () => {
                if (!this.value || !context.calleeResult) {
                    context.scope.releaseVariables()
                    context.scope.emitted.push({
                        kind: 'RETURN',
                    })
                    return
                }

                return _Failable.pipe(
                    _Failable.collect([
                        this.value._currentValue(context),
                        Retain.ifStorage(this.value, {
                            ...context,
                            ...{ isolationLevel: undefined },
                        }),
                    ]),
                    ([lattice, retainedValue]) =>
                        retainedValue
                            ._toCIRExpression(context)
                            .chaining(
                                (retainedValueCIR) =>
                                    [
                                        lattice,
                                        retainedValue,
                                        retainedValueCIR,
                                    ] as const,
                            ),
                    ([lattice, retainedValue, retainedValueCIR]) => {
                        if (retainedValue instanceof Retain) {
                            context.scope.emitted.push({
                                kind: 'ENSURE_UNIQUE',
                                object: retainedValue.value
                                    ._toCIRExpression(context)
                                    .value(),
                            })
                            const temp = context.scope.nextTempVar()
                            context.scope.emitted.push({
                                kind: 'VARIABLE_DECL',
                                name: temp,
                                lattice: lattice.toCIR(),
                                initialValue: retainedValueCIR,
                            })
                            context.scope.releaseVariables()
                            context.scope.emitted.push({
                                kind: 'RETURN',
                                value: {
                                    kind: 'VARIABLE_REF',
                                    name: temp,
                                    value: retainedValueCIR.value,
                                },
                            })
                        } else {
                            context.scope.releaseVariables()
                            context.scope.emitted.push({
                                kind: 'RETURN',
                                value: retainedValueCIR,
                            })
                        }
                    },
                )
            })
            .throwIfFailure()
    }

    private validateInput(context: Context): _Failable {
        if (!this.value) {
            return context.calleeResult
                ? _Failable.failure(
                      `Must return a ${context.calleeResult.lattice.toString()} value`,
                      this.span,
                  )
                : _Failable.success(undefined)
        }

        return _Failable.pipe(
            _Failable.success(context.calleeResult),
            (calleeResult) =>
                calleeResult ||
                _Failable.failure(
                    'Called function has no return value',
                    this.value!.span,
                ),
            (calleeResult) =>
                _Failable.collect([
                    calleeResult,
                    this.value?._currentValue(context),
                ]),
            ([calleeResult, lattice]) => {
                if (!lattice) {
                    throw new Error(
                        `Return statement value does not have a lattice: ${JSON.stringify(
                            this.value,
                        )}`,
                    )
                }
                return !calleeResult.lattice.isSupersetTo(lattice)
                    ? _Failable.failure(
                          'Return value type mismatch',
                          this.value!.span,
                      )
                    : calleeResult
            },
            (calleeResult) =>
                this.value!._isolationLevel(context).chaining(
                    (isolationLevel) =>
                        calleeResult.isolationLevel !== isolationLevel
                            ? _Failable.failure(
                                  `Cannot return an ${this.value?._isolationLevel(context).value()} value as ${calleeResult.isolationLevel}`,
                                  this.value!.span,
                              )
                            : undefined,
                ),
        )
    }
}
