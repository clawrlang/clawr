#ifndef CLAWR_REAL_H
#define CLAWR_REAL_H

#include "clawr_string.h"
#include "integer.h"
#include "refc.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

// Arbitrary-precision decimal real.
// value = significand × 10^exponent10
// Strings are only materialized on demand (toString / fromString boundaries).
typedef struct Real {
  __rc_header header;
  Integer *significand;
  Integer *exponent10;
  size_t precision;
  bool scale_precision;
  String *string_cache; // nullable; lazy-built by toStringRC
  bool cache_valid;
} Real;
typedef struct Realˇproperties {
  Integer *significand;
  Integer *exponent10;
  size_t precision;
  bool scale_precision;
  String *string_cache; // nullable; lazy-built by toStringRC
  bool cache_valid;
} Realˇproperties;
extern const __type_info Realˇtype;

/// Parse a decimal real with an explicit scale or significant-digit precision.
Real *Real¸fromString(const char *value, size_t precision,
                      bool scale_precision);
Real *Real¸ensureInRange(Real *value, const char *min, const char *max);
Real *Real¸fromInteger(Integer *value, size_t precision,
                       bool scale_precision);
Real *Real¸fromInt64(int64_t value, size_t precision, bool scale_precision);
/// Exact-shortest decimal value of a binary float, for boxing and printing.
Real *Real¸fromBinary(double value, bool single_precision);
String *Real·toStringRC(Real *self);
const char *Real·toString(Real *self);
Real *Real¸add(Real *left, Real *right, size_t result_precision);
Real *Real¸subtract(Real *left, Real *right, size_t result_precision);
Real *Real¸multiply(Real *left, Real *right, size_t result_precision);
Real *Real¸divide(Real *dividend, Real *divisor, size_t result_precision);
Real *Real¸power(Real *base, Real *exponent, size_t result_precision);
Real *Real¸round(Real *value, size_t result_precision);
int Real¸compare(Real *left, Real *right);

float Real32¸add(float left, float right);
float Real32¸subtract(float left, float right);
float Real32¸multiply(float left, float right);
float Real32¸divide(float left, float right);
float Real32¸power(float base, float exponent);
double Real64¸add(double left, double right);
double Real64¸subtract(double left, double right);
double Real64¸multiply(double left, double right);
double Real64¸divide(double left, double right);
double Real64¸power(double base, double exponent);

#endif // CLAWR_REAL_H
