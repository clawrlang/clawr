# Prune CIR Banches

`FunctionCall.currentValue()` should use parameters, `self` and the function body to figure out the returned value lattice

An optimization step can use this analysis to remove the function call entirely if the lattice is a singleton.
But even before pruning, this feature can help narrow the value lattice, which is probably valuable.

This only applies to `object`, not `service`.

- The recipient’s `currentValue()` should be set as `self` value when analyzing the body of an ´object`method
- The recipient’s current value should be updated to `self`’s state in the parent scope when exiting a `mutating:` `object` method
