#ifndef CLAWR_RUNTIME_H
#define CLAWR_RUNTIME_H

#include <stdarg.h>

#include "TruthValueBox.h"
#include "array.h"
#include "clawr_string.h"
#include "integer.h"
#include "interfaces.h"
#include "lanes.h"
#include "real.h"
#include "panic.h"
#include "refc.h"

static void print(void *value) {
  const clawr¸HasStringRepresentationˇwitness *witness =
      CONFORMANCE_ENTRY(value, clawr¸HasStringRepresentation);
  String *string = witness->stringRepresentation(value);
  printf("%s\n", string->data);
  releaseRC(string);
}

static void *copy˛of(void *value) { return copyRC(value, __rc_SHARED); }

/// @brief Integer division rounding towards negative infinity (ADR-023)
static inline int64_t floorDiv64(int64_t dividend, int64_t divisor) {
  if (divisor == 0)
    panic("Division by zero!");
  int64_t quotient = dividend / divisor;
  int64_t remainder = dividend % divisor;
  return remainder != 0 && ((remainder < 0) != (divisor < 0)) ? quotient - 1
                                                              : quotient;
}

/// @brief Remainder matching floorDiv64: n - floor(n / d) * d
static inline int64_t floorMod64(int64_t dividend, int64_t divisor) {
  if (divisor == 0)
    panic("Division by zero!");
  int64_t remainder = dividend % divisor;
  return remainder != 0 && ((remainder < 0) != (divisor < 0))
             ? remainder + divisor
             : remainder;
}

Integer *integerWithDigits(const size_t count, ...) {
  Array *digits = Array¸new (count, sizeof(digit_t));

  va_list ap;
  va_start(ap, count);
  for (size_t i = 0; i < count; i++)
    ARRAY_ELEMENT_AT(i, digits, digit_t) = va_arg(ap, digit_t);
  va_end(ap);

  Integer *integer = Integer¸withDigits(digits);
  releaseRC(digits);
  return integer;
}

#endif // CLAWR_RUNTIME_H
