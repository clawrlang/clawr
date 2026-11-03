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
  size_t binary_bits; // 0 for decimal reals; else the binary significand width
  unsigned grid_base; // 0, or 2/3 for `scale n` reals on a binary/ternary grid
} Real;
typedef struct Realˇproperties {
  Integer *significand;
  Integer *exponent10;
  size_t precision;
  bool scale_precision;
  String *string_cache; // nullable; lazy-built by toStringRC
  bool cache_valid;
  size_t binary_bits;
  unsigned grid_base;
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
Real *Real¸fromBinary(double value, unsigned significand_bits);
/// Arbitrary-precision binary reals: significand × 2^exponent rounded to the
/// given number of significant bits after every operation (ties-to-even).
/// The value is stored exactly as a decimal, so any binary width is supported.
Real *Real¸roundBinary(Real *value, size_t bits);
Real *Real¸fromStringBinary(const char *value, size_t bits);
Real *Real¸fromIntegerBinary(Integer *value, size_t bits);
Real *Real¸fromInt64Binary(int64_t value, size_t bits);
Real *Real¸addBinary(Real *left, Real *right, size_t bits);
Real *Real¸subtractBinary(Real *left, Real *right, size_t bits);
Real *Real¸multiplyBinary(Real *left, Real *right, size_t bits);
Real *Real¸divideBinary(Real *dividend, Real *divisor, size_t bits);
Real *Real¸powerBinary(Real *base, Real *exponent, size_t bits);
/// `scale n` reals in base 2 or 3: the value is an integer multiple of
/// base^-n, rounded (ties-to-even) after every operation. Base 2 values are
/// stored as exact decimals; base 3 values store the numerator over 3^n.
Real *Real¸roundScale(Real *value, size_t n, unsigned base);
Real *Real¸fromStringScale(const char *value, size_t n, unsigned base);
Real *Real¸fromIntegerScale(Integer *value, size_t n, unsigned base);
Real *Real¸fromInt64Scale(int64_t value, size_t n, unsigned base);
Real *Real¸addScale(Real *left, Real *right, size_t n, unsigned base);
Real *Real¸subtractScale(Real *left, Real *right, size_t n, unsigned base);
Real *Real¸multiplyScale(Real *left, Real *right, size_t n, unsigned base);
Real *Real¸divideScale(Real *dividend, Real *divisor, size_t n, unsigned base);
Real *Real¸powerScale(Real *base, Real *exponent, size_t n, unsigned base_);
String *Real·toStringRC(Real *self);
const char *Real·toString(Real *self);
Real *Real¸add(Real *left, Real *right, size_t result_precision);
Real *Real¸subtract(Real *left, Real *right, size_t result_precision);
Real *Real¸multiply(Real *left, Real *right, size_t result_precision);
Real *Real¸divide(Real *dividend, Real *divisor, size_t result_precision);
Real *Real¸power(Real *base, Real *exponent, size_t result_precision);
Real *Real¸round(Real *value, size_t result_precision);
int Real¸compare(Real *left, Real *right);

#ifdef __FLT16_MANT_DIG__
_Float16 Real16¸add(_Float16 left, _Float16 right);
_Float16 Real16¸subtract(_Float16 left, _Float16 right);
_Float16 Real16¸multiply(_Float16 left, _Float16 right);
_Float16 Real16¸divide(_Float16 left, _Float16 right);
_Float16 Real16¸power(_Float16 base, _Float16 exponent);
#endif
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
