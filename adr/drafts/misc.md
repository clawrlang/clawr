# Miscellaneous Ideas

## Pipeline

- `f3 = f1 |> f2`
- or `(\_ => getX()) |> useX`

## Annotations with implicit strings

```clawr
@REST GET /user/{partnerId}/atom
get(partnerId: string) -> [Atom]
```

## Error handling

- `defer {}`
- `Result<ok, error>`
- Precondition

## Matrix

```clawr
const x: real[,]  // 2D matrix
const y: real[,,] // 3D matrix
```
Is a 3D matrix meaningful?

We could define matrices by their size. If the second size parameter is 1 it is a column vector, if the first is one it is a row vector. (Are row vectors meaningful?)

An nxm matrix time an nx1 column vector creates an mx1 column vector.

Same-size column vectors can be dot multiplied (with a scalar result) and cross multiplied (yielding a new vector).

## Operator Precedence

| Level  | Category                  | Operators                                   | Applies To           |
| :----: | :------------------------ | :------------------------------------------ | :------------------- |
| **12** | **Postfix / access**      | `.`, `[]`, `()`, `?.`, `!`, `!.`, `++`/`--` | all                  |
| **11** | **Unary / prefix**        | `-`, `+`, `!`, `~`, `copy`, `await`, `not`  | all                  |
| **10** | **Bitwise shift**         | `<<`, `>>`                                  | bitfield             |
| **9**  | **Exponentiation**        | `^`                                         | integer              |
| **9**  | **Bitwise and, xor**      | `^`, `&`                                    | bitfield             |
| **7**  | **Multiplicative**        | `*`, `/`, `%`                               | integer              |
| **6**  | **Bitwise or**            | `\|`                                        | bitfield             |
| **6**  | **Additive**              | `+`, `-`                                    | integer              |
| **6**  | **Concatenation**         | `+`                                         | string               |
| **5**  | **Comparison / equality** | `<`, `>`, `<=`, `>=`, `==`, `!=`            | all comparable types |
| **4**  | **Logical AND**           | `&&`                                        | bool                 |
| **3**  | **Logical OR**            | `\|\|`                                      | bool                 |
| **2**  | **Conditional**           | `a if cond else b`                          | all                  |
| **1**  | **Assignment**            | `=`, `*=`, `+=`, `-=`, `<<=`…               | all                  |
## String Interpolation

Optimisation: String interpolation of simple values should be inlined as if they were not interpolated.

```clawr
enum Result { success = 0, failureType1 = 1, failureType2 = 2 }

// Whatever the syntax is...
const sql = $"""
  SELECT
      CASE
          WHEN EXISTS (SELECT 1 FROM Users WHERE id = @id) THEN {Result.failureType1}
          WHEN @partnerId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PartnerCheck WHERE @partnerId IS NOT NULL) THEN {Result.failureType2}
          ELSE {Result.success}
      END AS result_code;
  """
```

Should be equivalent:

```clawr
// No interpolation
const sql = """
  SELECT
      CASE
          WHEN EXISTS (SELECT 1 FROM Users WHERE id = @id) THEN 1
          WHEN @partnerId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM PartnerCheck WHERE @partnerId IS NOT NULL) THEN 2
          ELSE 0
      END AS result_code;
  """
```

## Packed `data`

(Could just be a backend optimization?)
