&nbsp; / &nbsp; [Architecture Decision Records](../README.md) &nbsp; / &nbsp; [Drafts](./README.md)

# Nested Functions and Lambdas

> Status: ✍🏼 Draft

## Context

```ts
// Example of a nested function and a lambda in TypeScript
function outerFunction(x: number) {
  function nestedFunction(y: number) {
    return y * 2
  }
  const lambda = (z: number) => z + 1
  return nestedFunction(x) + lambda(x)
}
```

TypeScript has a problem with captured variables and execution order when using nested functions and lambdas, especially in asynchronous contexts. This can lead to unexpected behavior if the captured variables are modified after the lambda is created but before it is executed.

```ts
function brokenExample() {
  innerFunction()
  const captured = 0

  // The inner function is called before 'captured' is assigned its value, leading to a potentially confusing bug.
  function innerFunction() {
    console.log(captured) // undefined
  }
}
```

The inner function is called before 'captured' is assigned its value, leading to a confusing bug. Clawr should be aware of this execution order issue when using captured variables. Either require the captured variable to be declared before the inner function is called or modify the execution order to avoid the issue.

Modifying the execution order is not a generally applicable solution, however, as it may not be feasible or desirable in all contexts. The correct approach is probably to just emit an error and let the programmer sort out the proper execution order.

## Decision

## Rationale

## Alternatives Considered

## Consequences

### Positive

### Negative

## Related ADRs
