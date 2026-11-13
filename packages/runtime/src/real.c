#include "real.h"
#include "interfaces.h"
#include "hash.h"
#include "panic.h"

#include <math.h>
#include <errno.h>
#include <limits.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ---------------------------------------------------------------------------
// RC hooks
// ---------------------------------------------------------------------------

static void retainNestedProperties(void *self) {
  Real *real = (Real *)self;
  retainRC(real->significand);
  retainRC(real->exponent10);
}

static void releaseNestedProperties(void *self) {
  Real *real = (Real *)self;
  releaseRC(real->significand);
  releaseRC(real->exponent10);
  if (real->string_cache)
    releaseRC(real->string_cache);
}

__attribute__((visibility("default")))
const clawr¸HasStringRepresentationˇwitness
    Realˇclawr¸HasStringRepresentationˇwitness = {
        .stringRepresentation = (String * (*)(void *)) Real·toStringRC,
};
__interface_conformance_entry Realˇclawr¸HasStringRepresentationˇconformance = {
    .interface = &clawr¸HasStringRepresentationˇtype,
    .witness_table = &Realˇclawr¸HasStringRepresentationˇwitness,
};

__attribute__((visibility("default"))) const __type_info Realˇtype = {
    .data_type =
        {
            .size = sizeof(Real),
            .retain_nested_properties = retainNestedProperties,
            .release_nested_properties = releaseNestedProperties,
            .conformances =
                (const __interface_conformance_entry *[]){
                    &Realˇclawr¸HasStringRepresentationˇconformance,
                    &Realˇhash_conformance,
                    &Realˇequal_conformance,
                    NULL,
                },
        },
};

// ---------------------------------------------------------------------------
// Small-integer helpers (no public Integer API for construction from digit_t)
// ---------------------------------------------------------------------------

// Create an Integer whose value equals one balanced digit.
static Integer *integerFromDigit(digit_t v) {
  if (v == 0)
    return retainRC(&Integer¸zero);
  Array *digits = Array¸new(1, sizeof(digit_t));
  ARRAY_ELEMENT_AT(0, digits, digit_t) = v;
  return allocInitRC(Integer, 0, __rc_ISOLATED, .digits = digits);
}

// Create an Integer representing 10^n (n >= 0).
static Integer *integerPowerOf10(size_t n) {
  Integer *result = integerFromDigit(1);
  Integer *ten = integerFromDigit(10);
  for (size_t i = 0; i < n; i++) {
    Integer *next = Integer¸multiply(result, ten);
    releaseRC(result);
    result = next;
  }
  releaseRC(ten);
  return result;
}

static Integer *integerFromSize(size_t value) {
  char text[3 * sizeof(size_t) + 1];
  snprintf(text, sizeof(text), "%zu", value);
  return Integer¸fromCString(text);
}

static bool integerToSize(Integer *value, size_t *result) {
  String *text = Integer·toStringRC(value);
  const char *raw = String·toCString(text);
  if (raw[0] == '-') {
    releaseRC(text);
    return false;
  }
  errno = 0;
  unsigned long long parsed = strtoull(raw, NULL, 10);
  bool fits = errno == 0 && parsed <= SIZE_MAX;
  if (fits)
    *result = (size_t)parsed;
  releaseRC(text);
  return fits;
}

static bool integerToInt64(Integer *value, int64_t *result) {
  String *text = Integer·toStringRC(value);
  const char *raw = String·toCString(text);
  errno = 0;
  long long parsed = strtoll(raw, NULL, 10);
  bool fits = errno == 0;
  if (fits)
    *result = (int64_t)parsed;
  releaseRC(text);
  return fits;
}

static bool integerIsNegative(Integer *value) {
  String *text = Integer·toStringRC(value);
  bool negative = String·toCString(text)[0] == '-';
  releaseRC(text);
  return negative;
}

static bool integerIsZero(Integer *value) {
  String *text = Integer·toStringRC(value);
  bool zero = strcmp(String·toCString(text), "0") == 0;
  releaseRC(text);
  return zero;
}

static size_t integerDigitCount(Integer *value) {
  String *text = Integer·toStringRC(value);
  const char *raw = String·toCString(text);
  size_t count = strlen(raw) - (raw[0] == '-' ? 1 : 0);
  releaseRC(text);
  return count;
}

static Integer *integerAbs(Integer *value) {
  if (!integerIsNegative(value))
    return retainRC(value);
  return Integer¸subtract(&Integer¸zero, value);
}

static Integer *integerIncrement(Integer *value) {
  Integer *one = integerFromDigit(1);
  Integer *result = Integer¸add(value, one);
  releaseRC(one);
  return result;
}

static int compareIntegers(Integer *left, Integer *right) {
  String *left_string = Integer·toStringRC(left);
  String *right_string = Integer·toStringRC(right);
  const char *left_raw = String·toCString(left_string);
  const char *right_raw = String·toCString(right_string);
  bool left_negative = left_raw[0] == '-';
  bool right_negative = right_raw[0] == '-';
  if (left_negative != right_negative) {
    releaseRC(left_string);
    releaseRC(right_string);
    return left_negative ? -1 : 1;
  }

  const char *left_digits = left_negative ? left_raw + 1 : left_raw;
  const char *right_digits = right_negative ? right_raw + 1 : right_raw;
  size_t left_length = strlen(left_digits);
  size_t right_length = strlen(right_digits);
  int result = 0;
  if (left_length != right_length)
    result = left_length > right_length ? 1 : -1;
  else {
    int lexical = memcmp(left_digits, right_digits, left_length);
    result = lexical > 0 ? 1 : lexical < 0 ? -1 : 0;
  }
  releaseRC(left_string);
  releaseRC(right_string);
  return left_negative ? -result : result;
}

// ---------------------------------------------------------------------------
// Significand parsing: convert decimal digit string to Integer.
// Processes in groups of 18 to stay comfortably within a single balanced digit.
// ---------------------------------------------------------------------------

static Integer *parseSignificand(const char *digits, size_t len) {
  Integer *result = retainRC(&Integer¸zero);
  Integer *base = integerFromDigit(1000000000000000000LL); // 10^18

  size_t i = 0;
  while (i < len) {
    size_t chunk = (len - i < 18) ? (len - i) : 18;
    digit_t limb = 0;
    for (size_t k = 0; k < chunk; k++)
      limb = limb * 10 + (digits[i + k] - '0');

    // result = result * 10^chunk + limb
    Integer *scale = integerFromDigit((digit_t[]){
        1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000,
        1000000000, 10000000000LL, 100000000000LL, 1000000000000LL,
        10000000000000LL, 100000000000000LL, 1000000000000000LL,
        10000000000000000LL, 100000000000000000LL,
        1000000000000000000LL}[chunk]);
    Integer *shifted = Integer¸multiply(result, scale);
    releaseRC(scale);
    releaseRC(result);

    Integer *limbInt = integerFromDigit(limb);
    result = Integer¸add(shifted, limbInt);
    releaseRC(shifted);
    releaseRC(limbInt);

    i += chunk;
  }

  releaseRC(base);
  return result;
}

// ---------------------------------------------------------------------------
// Normalization: remove trailing zeros from significand, adjust exponent.
// ---------------------------------------------------------------------------

static void normalize(Integer **sig, Integer **exp) {
  Integer *ten = integerFromDigit(10);

  while (true) {
    // Check if significand is zero — stop immediately.
    bool is_zero = true;
    for (size_t i = 0; i < (*sig)->digits->count; i++) {
      if (ARRAY_ELEMENT_AT(i, (*sig)->digits, digit_t) != 0) {
        is_zero = false;
        break;
      }
    }
    if (is_zero)
      break;

    // Check last decimal digit using single-digit division.
    Integer *tmp = retainRC(*sig);
    mutateRC(tmp);
    digit_t rem = Integer·divide(tmp, 10);
    releaseRC(tmp);
    if (rem != 0)
      break;

    // Strip a trailing zero.
    Integer *next = Integer¸divide(*sig, ten);
    releaseRC(*sig);
    *sig = next;
    Integer *next_exp = integerIncrement(*exp);
    releaseRC(*exp);
    *exp = next_exp;
  }

  releaseRC(ten);
}

static void roundToPrecision(Integer **sig, Integer **exp, size_t precision,
                             bool scale_precision) {
  String *raw_obj = Integer·toStringRC(*sig);
  const char *raw = String·toCString(raw_obj);
  bool negative = raw[0] == '-';
  const char *digits = negative ? raw + 1 : raw;
  size_t digit_count = strlen(digits);
  if (digit_count == 1 && digits[0] == '0') {
    releaseRC(raw_obj);
    return;
  }

  size_t drop;
  Integer *drop_integer = NULL;
  if (scale_precision) {
    Integer *cutoff_magnitude = integerFromSize(precision);
    Integer *cutoff =
        Integer¸subtract(&Integer¸zero, cutoff_magnitude);
    releaseRC(cutoff_magnitude);
    if (compareIntegers(*exp, cutoff) >= 0) {
      releaseRC(cutoff);
      releaseRC(raw_obj);
      return;
    }
    drop_integer = Integer¸subtract(cutoff, *exp);
    releaseRC(cutoff);
    if (!integerToSize(drop_integer, &drop))
      drop = SIZE_MAX;
  } else {
    drop = digit_count > precision ? digit_count - precision : 0;
    drop_integer = integerFromSize(drop);
  }
  if (drop == 0) {
    releaseRC(drop_integer);
    releaseRC(raw_obj);
    return;
  }

  size_t kept_count = digit_count > drop ? digit_count - drop : 0;
  char *kept = malloc(kept_count + 2);
  if (!kept)
    panic("Out of memory rounding Real");
  if (kept_count)
    memcpy(kept, digits, kept_count);
  else {
    kept[0] = '0';
    kept_count = 1;
  }
  kept[kept_count] = '\0';

  bool round_up = false;
  if (drop <= digit_count) {
    size_t first_discarded = kept_count;
    char first = digits[first_discarded];
    bool remaining_nonzero = false;
    for (size_t i = first_discarded + 1; i < digit_count; i++)
      remaining_nonzero |= digits[i] != '0';
    unsigned last_digit = (unsigned)(kept[kept_count - 1] - '0');
    round_up = first > '5' ||
               (first == '5' && (remaining_nonzero || (last_digit & 1)));
  }

  Integer *rounded = Integer¸fromCString(kept);
  if (round_up) {
    Integer *one = integerFromDigit(1);
    Integer *next = Integer¸add(rounded, one);
    releaseRC(one);
    releaseRC(rounded);
    rounded = next;
  }
  if (negative)
    Integer·toggleSign(rounded);
  releaseRC(*sig);
  *sig = rounded;
  Integer *next_exp = Integer¸add(*exp, drop_integer);
  releaseRC(*exp);
  *exp = next_exp;
  releaseRC(drop_integer);
  free(kept);
  releaseRC(raw_obj);
}

// ---------------------------------------------------------------------------
// String cache helpers
// ---------------------------------------------------------------------------

static char *cloneString(const char *s) {
  size_t len = strlen(s);
  char *out = malloc(len + 1);
  if (!out)
    panic("Out of memory in Real string clone");
  memcpy(out, s, len + 1);
  return out;
}

// Build decimal string from significand + exponent10.
// Returns an owned String object.
static String *formatReal(Integer *sig, Integer *exp) {
  // Get the absolute decimal digit string from Integer·toString.
  // Integer·toString includes a leading '-' for negatives.
  String *rawString = Integer·toStringRC(sig);
  const char *raw = String·toCString(rawString);
  bool negative = (raw[0] == '-');
  const char *digits = negative ? raw + 1 : raw;
  size_t ndigits = strlen(digits);

  // Handle zero specially.
  if (ndigits == 0 || (ndigits == 1 && digits[0] == '0')) {
    releaseRC(rawString);
    return String¸fromCString("0.0");
  }

  // The value is:  digits * 10^exp
  // We want to render it in decimal notation where possible.
  // dot_pos = position of decimal point from the left of `digits`.
  //   dot_pos = ndigits + exp  (i.e. number of digits before the point)
  //
  // Examples:
  //   digits="123", exp=-2  → dot_pos=1  → "1.23"
  //   digits="1",   exp=0   → dot_pos=1  → "1.0"
  //   digits="1",   exp=2   → dot_pos=3  → "100.0"
  //   digits="333", exp=-5  → dot_pos=-2 → "0.00333"

  int64_t exp_value;
  bool use_decimal_notation =
      integerToInt64(exp, &exp_value) &&
      exp_value >= -100000 && exp_value <= 100000;
  int64_t dot_pos =
      use_decimal_notation ? (int64_t)ndigits + exp_value : 0;
  use_decimal_notation =
      use_decimal_notation && dot_pos >= -100000 && dot_pos <= 100000;

  if (!use_decimal_notation) {
    Integer *digit_offset = integerFromSize(ndigits - 1);
    Integer *scientific_exp = Integer¸add(exp, digit_offset);
    releaseRC(digit_offset);
    String *exp_string = Integer·toStringRC(scientific_exp);
    const char *exp_text = String·toCString(exp_string);
    size_t exp_len = strlen(exp_text);
    size_t out_len = (negative ? 1 : 0) + ndigits + exp_len + 4;
    char *out = malloc(out_len);
    if (!out)
      panic("Out of memory in Real formatter");
    char *p = out;
    if (negative)
      *p++ = '-';
    *p++ = digits[0];
    *p++ = '.';
    if (ndigits > 1) {
      memcpy(p, digits + 1, ndigits - 1);
      p += ndigits - 1;
    } else {
      *p++ = '0';
    }
    *p++ = 'e';
    memcpy(p, exp_text, exp_len);
    p += exp_len;
    *p = '\0';
    String *result = String¸fromCString(out);
    free(out);
    releaseRC(exp_string);
    releaseRC(scientific_exp);
    releaseRC(rawString);
    return result;
  }

  // Determine output buffer size (generous upper bound).
  size_t extra = 16; // sign, '.', leading/trailing zeros, ".0", NUL
  size_t bufsize =
      (negative ? 1 : 0) + ndigits + extra +
      (dot_pos < 0 ? (size_t)(-dot_pos) : 0) +
      (dot_pos > (int64_t)ndigits ? (size_t)(dot_pos - ndigits) : 0);
  char *out = malloc(bufsize);
  if (!out)
    panic("Out of memory in Real formatter");

  char *p = out;
  if (negative)
    *p++ = '-';

  if (dot_pos <= 0) {
    // All digits are fractional, possibly with leading zeros after the point.
    *p++ = '0';
    *p++ = '.';
    for (int64_t z = 0; z < -dot_pos; z++)
      *p++ = '0';
    memcpy(p, digits, ndigits);
    p += ndigits;
  } else if (dot_pos >= (int64_t)ndigits) {
    // All digits are before the decimal point, with possible trailing zeros.
    memcpy(p, digits, ndigits);
    p += ndigits;
    for (int64_t z = ndigits; z < dot_pos; z++)
      *p++ = '0';
    *p++ = '.';
    *p++ = '0'; // type-revealing marker
  } else {
    // Decimal point falls within the digits.
    memcpy(p, digits, (size_t)dot_pos);
    p += dot_pos;
    *p++ = '.';
    memcpy(p, digits + dot_pos, ndigits - (size_t)dot_pos);
    p += ndigits - (size_t)dot_pos;
  }
  *p = '\0';

  String *result = String¸fromCString(out);
  free(out);
  releaseRC(rawString);
  return result;
}

// ---------------------------------------------------------------------------
// fromString
// ---------------------------------------------------------------------------

static Real *realWithSigExp(Integer *sig, Integer *exp, size_t precision,
                            bool scale_precision);
static Real *realFromStringImpl(const char *value, size_t precision,
                                bool scale_precision, bool round);

__attribute__((visibility("default")))
Real *Real¸fromString(const char *value, size_t precision,
                      bool scale_precision) {
  return realFromStringImpl(value, precision, scale_precision, true);
}

/// Parses a value without rounding it (used for exact range bounds).
static Real *realFromStringExact(const char *value) {
  return realFromStringImpl(value, 0, true, false);
}

static Real *realFromStringImpl(const char *value, size_t precision,
                                bool scale_precision, bool round) {
  if (!scale_precision && precision == 0)
    panic("Invalid real precision");
  // Strip readability underscores.
  size_t vlen = strlen(value);
  char *stripped = malloc(vlen + 1);
  if (!stripped)
    panic("Out of memory in Real¸fromString");
  size_t j = 0;
  for (size_t i = 0; i < vlen; i++)
    if (value[i] != '_')
      stripped[j++] = value[i];
  stripped[j] = '\0';

  bool negative = (stripped[0] == '-');
  const char *s = negative ? stripped + 1 : stripped;

  // Split off scientific exponent if present.
  const char *eptr = strpbrk(s, "eE");
  Integer *sci_exp = integerFromDigit(0);
  if (eptr) {
    const char *exp_text = eptr + 1;
    const char *exp_digits = (*exp_text == '+' || *exp_text == '-')
                                 ? exp_text + 1
                                 : exp_text;
    if (!*exp_digits) {
      releaseRC(sci_exp);
      free(stripped);
      panic("Invalid real literal (bad exponent)");
    }
    for (const char *p = exp_digits; *p; p++) {
      if (*p < '0' || *p > '9') {
        releaseRC(sci_exp);
        free(stripped);
        panic("Invalid real literal (bad exponent)");
      }
    }
    releaseRC(sci_exp);
    sci_exp = Integer¸fromCString(exp_text);
  }

  // Find decimal point in the coefficient portion.
  size_t coeff_len = eptr ? (size_t)(eptr - s) : strlen(s);
  if (coeff_len == 0) {
    releaseRC(sci_exp);
    free(stripped);
    panic("Invalid real literal");
  }
  const char *dot = memchr(s, '.', coeff_len);
  size_t frac_len = 0;
  Integer *exp;
  char *digits_buf;

  if (dot) {
    size_t int_len = (size_t)(dot - s);
    frac_len = coeff_len - int_len - 1;
    digits_buf = malloc(int_len + frac_len + 1);
    if (!digits_buf)
      panic("Out of memory in Real¸fromString");
    memcpy(digits_buf, s, int_len);
    memcpy(digits_buf + int_len, dot + 1, frac_len);
    digits_buf[int_len + frac_len] = '\0';
  } else {
    digits_buf = malloc(coeff_len + 1);
    if (!digits_buf)
      panic("Out of memory in Real¸fromString");
    memcpy(digits_buf, s, coeff_len);
    digits_buf[coeff_len] = '\0';
  }
  Integer *fractional_digits = integerFromSize(frac_len);
  Integer *negative_fractional_digits =
      Integer¸subtract(&Integer¸zero, fractional_digits);
  releaseRC(fractional_digits);
  exp = Integer¸add(sci_exp, negative_fractional_digits);
  releaseRC(sci_exp);
  releaseRC(negative_fractional_digits);
  if (digits_buf[0] == '\0') {
    free(digits_buf);
    free(stripped);
    releaseRC(exp);
    panic("Invalid real literal");
  }

  // Validate all characters are decimal digits.
  for (size_t i = 0; digits_buf[i]; i++) {
    if (digits_buf[i] < '0' || digits_buf[i] > '9') {
      free(digits_buf);
      free(stripped);
      releaseRC(exp);
      panic("Invalid real literal");
    }
  }

  // Skip leading zeros in digit string (but keep at least one).
  const char *d = digits_buf;
  while (*d == '0' && *(d + 1))
    d++;

  Integer *sig = parseSignificand(d, strlen(d));
  normalize(&sig, &exp);

  if (negative)
    Integer·toggleSign(sig);

  Real *real;
  if (round)
    real = realWithSigExp(sig, exp, precision, scale_precision);
  else
    real = allocInitRC(Real, 0, __rc_ISOLATED, .significand = sig,
                       .exponent10 = exp, .precision = precision,
                       .scale_precision = scale_precision,
                       .string_cache = NULL, .cache_valid = false);

  free(digits_buf);
  free(stripped);
  return real;
}

__attribute__((visibility("default")))
Real *Real¸fromInteger(Integer *value, size_t precision,
                       bool scale_precision) {
  String *text = Integer·toStringRC(value);
  Real *result =
      Real¸fromString(String·toCString(text), precision, scale_precision);
  releaseRC(text);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸fromInt64(int64_t value, size_t precision,
                     bool scale_precision) {
  Integer *integer = Integer¸fromInt64(value);
  Real *result = Real¸fromInteger(integer, precision, scale_precision);
  releaseRC(integer);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸ensureInRange(Real *value, const char *min, const char *max) {
  if (min) {
    Real *lower = realFromStringExact(min);
    int comparison = Real¸compare(value, lower);
    releaseRC(lower);
    if (comparison < 0)
      panic("Real value is below its declared minimum");
  }
  if (max) {
    Real *upper = realFromStringExact(max);
    int comparison = Real¸compare(value, upper);
    releaseRC(upper);
    if (comparison > 0)
      panic("Real value is above its declared maximum");
  }
  return value;
}

// ---------------------------------------------------------------------------
// toString
// ---------------------------------------------------------------------------

static String *formatBinaryReal(Real *self);
static String *formatTernaryScale(Real *self);

__attribute__((visibility("default"))) String *Real·toStringRC(Real *self) {
  if (!self->cache_valid) {
    if (self->string_cache)
      releaseRC(self->string_cache);
    self->string_cache = self->grid_base == 3 ? formatTernaryScale(self)
                         : self->binary_bits  ? formatBinaryReal(self)
                                              : formatReal(self->significand,
                                                           self->exponent10);
    self->cache_valid = true;
  }
  return retainRC(self->string_cache);
}

__attribute__((visibility("default"))) const char *Real·toString(Real *self) {
  String *s = Real·toStringRC(self);
  const char *out = cloneString(String·toCString(s));
  releaseRC(s);
  return out;
}

// ---------------------------------------------------------------------------
// Arithmetic helpers
// ---------------------------------------------------------------------------

// Align two reals to a common exponent; returns new significands (owned).
// After alignment: left_out * 10^common_exp == left->value, same for right.
static void alignExponents(Real *left, Real *right, Integer **left_out,
                           Integer **right_out, Integer **common_exp) {
  int exponent_order = compareIntegers(left->exponent10, right->exponent10);
  if (exponent_order == 0) {
    *left_out = retainRC(left->significand);
    *right_out = retainRC(right->significand);
    *common_exp = retainRC(left->exponent10);
    return;
  }
  if (exponent_order > 0) {
    // Scale left up: left_sig * 10^(left.exp - right.exp)
    Integer *diff =
        Integer¸subtract(left->exponent10, right->exponent10);
    size_t diff_size;
    if (!integerToSize(diff, &diff_size))
      panic("Real addition requires more memory than the exponent range permits");
    releaseRC(diff);
    Integer *scale = integerPowerOf10(diff_size);
    *left_out = Integer¸multiply(left->significand, scale);
    releaseRC(scale);
    *right_out = retainRC(right->significand);
    *common_exp = retainRC(right->exponent10);
  } else {
    Integer *diff =
        Integer¸subtract(right->exponent10, left->exponent10);
    size_t diff_size;
    if (!integerToSize(diff, &diff_size))
      panic("Real addition requires more memory than the exponent range permits");
    releaseRC(diff);
    Integer *scale = integerPowerOf10(diff_size);
    *left_out = retainRC(left->significand);
    *right_out = Integer¸multiply(right->significand, scale);
    releaseRC(scale);
    *common_exp = retainRC(left->exponent10);
  }
}

static Real *realWithSigExp(Integer *sig, Integer *exp, size_t precision,
                            bool scale_precision) {
  if (!scale_precision && precision == 0)
    panic("Invalid real precision");
  roundToPrecision(&sig, &exp, precision, scale_precision);
  normalize(&sig, &exp);
  return allocInitRC(Real, 0, __rc_ISOLATED, .significand = sig,
                     .exponent10 = exp, .precision = precision,
                     .scale_precision = scale_precision,
                     .string_cache = NULL, .cache_valid = false);
}

__attribute__((visibility("default")))
Real *Real¸round(Real *value, size_t result_precision) {
  return realWithSigExp(retainRC(value->significand),
                        retainRC(value->exponent10), result_precision,
                        value->scale_precision);
}

static void requireCompatiblePrecision(Real *left, Real *right) {
  if (left->scale_precision != right->scale_precision)
    panic("Real operands must have matching precision kinds in the runtime");
}

// ---------------------------------------------------------------------------
// Public arithmetic
// ---------------------------------------------------------------------------

__attribute__((visibility("default"))) Real *
Real¸add(Real *left, Real *right, size_t result_precision) {
  requireCompatiblePrecision(left, right);
  Integer *ls;
  Integer *rs;
  Integer *exp;
  alignExponents(left, right, &ls, &rs, &exp);
  Integer *sum = Integer¸add(ls, rs);
  releaseRC(ls);
  releaseRC(rs);
  return realWithSigExp(sum, exp, result_precision, left->scale_precision);
}

__attribute__((visibility("default")))
Real *Real¸subtract(Real *left, Real *right, size_t result_precision) {
  requireCompatiblePrecision(left, right);
  Integer *ls;
  Integer *rs;
  Integer *exp;
  alignExponents(left, right, &ls, &rs, &exp);
  Integer *diff = Integer¸subtract(ls, rs);
  releaseRC(ls);
  releaseRC(rs);
  return realWithSigExp(diff, exp, result_precision, left->scale_precision);
}

__attribute__((visibility("default")))
Real *Real¸multiply(Real *left, Real *right, size_t result_precision) {
  requireCompatiblePrecision(left, right);
  Integer *prod = Integer¸multiply(left->significand, right->significand);
  Integer *exp = Integer¸add(left->exponent10, right->exponent10);
  return realWithSigExp(prod, exp, result_precision, left->scale_precision);
}

__attribute__((visibility("default")))
Real *Real¸divide(Real *dividend, Real *divisor, size_t result_precision) {
  requireCompatiblePrecision(dividend, divisor);
  // Check for zero divisor.
  bool divisor_zero = true;
  for (size_t i = 0; i < divisor->significand->digits->count; i++) {
    if (ARRAY_ELEMENT_AT(i, divisor->significand->digits, digit_t) != 0) {
      divisor_zero = false;
      break;
    }
  }
  if (divisor_zero)
    panic("Division by zero!");

  size_t prec = result_precision;
  bool scale_mode = dividend->scale_precision;

  // Scale the dividend so the quotient has at least one digit more than the
  // result keeps, then add a sticky digit so rounding sees inexact quotients.
  Integer *exp_difference =
      Integer¸subtract(dividend->exponent10, divisor->exponent10);
  int64_t difference;
  if (!integerToInt64(exp_difference, &difference))
    panic("Real division requires more memory than available");
  releaseRC(exp_difference);

  int64_t shift;
  if (scale_mode)
    shift = difference + (int64_t)prec + 1;
  else
    shift = (int64_t)prec + 2 + (int64_t)integerDigitCount(divisor->significand) -
            (int64_t)integerDigitCount(dividend->significand);
  if (shift < 0)
    shift = 0;

  Integer *scale = integerPowerOf10((size_t)shift);
  Integer *scaled = Integer¸multiply(dividend->significand, scale);
  releaseRC(scale);

  // Integer¸divide truncates towards zero; work with magnitudes.
  bool negative = integerIsNegative(scaled) != integerIsNegative(divisor->significand);
  Integer *scaled_magnitude = integerAbs(scaled);
  Integer *divisor_magnitude = integerAbs(divisor->significand);
  releaseRC(scaled);
  Integer *quotient = Integer¸divide(scaled_magnitude, divisor_magnitude);
  Integer *product = Integer¸multiply(quotient, divisor_magnitude);
  Integer *remainder = Integer¸subtract(scaled_magnitude, product);
  bool inexact = !integerIsZero(remainder);
  releaseRC(product);
  releaseRC(remainder);
  releaseRC(scaled_magnitude);
  releaseRC(divisor_magnitude);

  Integer *ten = integerFromDigit(10);
  Integer *tenfold = Integer¸multiply(quotient, ten);
  releaseRC(ten);
  releaseRC(quotient);
  quotient = tenfold;
  if (inexact) {
    Integer *one = integerFromDigit(1);
    Integer *sticky = Integer¸add(quotient, one);
    releaseRC(one);
    releaseRC(quotient);
    quotient = sticky;
  }
  if (negative) {
    Integer *negated = Integer¸subtract(&Integer¸zero, quotient);
    releaseRC(quotient);
    quotient = negated;
  }

  // value = quotient × 10^(exponent difference - shift - 1)
  Integer *shift_total = integerFromSize((size_t)shift + 1);
  Integer *quotient_exp = Integer¸subtract(
      dividend->exponent10, divisor->exponent10);
  Integer *adjusted_exp = Integer¸subtract(quotient_exp, shift_total);
  releaseRC(quotient_exp);
  releaseRC(shift_total);

  return realWithSigExp(quotient, adjusted_exp, prec, scale_mode);
}

static Real *realBinaryFromSigExp(Integer *sig, Integer *exp, size_t bits);
static Real *powerImpl(Real *base, Real *exponent, size_t result_precision,
                       size_t binary_bits);

__attribute__((visibility("default")))
Real *Real¸power(Real *base, Real *exponent, size_t result_precision) {
  return powerImpl(base, exponent, result_precision, 0);
}

static Real *powerImpl(Real *base, Real *exponent, size_t result_precision,
                       size_t binary_bits) {
  // Exponent must be a whole number: no negative exponent10 (fractional
  // digits).
  if (compareIntegers(exponent->exponent10, &Integer¸zero) < 0)
    panic("Real exponentiation requires an integer exponent");

  // Build the full integer value: int_exp = significand * 10^exponent10
  Integer *int_exp;
  if (compareIntegers(exponent->exponent10, &Integer¸zero) == 0) {
    int_exp = retainRC(exponent->significand);
  } else {
    size_t exponent_size;
    if (!integerToSize(exponent->exponent10, &exponent_size))
      panic("Real exponentiation requires more memory than available");
    Integer *scale = integerPowerOf10(exponent_size);
    int_exp = Integer¸multiply(exponent->significand, scale);
    releaseRC(scale);
  }

  String *exp_str_obj = Integer·toStringRC(int_exp);
  const char *exp_str = String·toCString(exp_str_obj);
  bool negative_exponent = exp_str[0] == '-';
  if (negative_exponent) {
    Integer *absolute_exp = Integer¸subtract(&Integer¸zero, int_exp);
    releaseRC(int_exp);
    int_exp = absolute_exp;
  }

  // Convert exponent to unsigned long long; larger exponents cannot produce
  // an allocatable result.
  char *end;
  errno = 0;
  const char *exp_digits = negative_exponent ? exp_str + 1 : exp_str;
  unsigned long long e = strtoull(exp_digits, &end, 10);
  bool exponent_fits = errno == 0 && *end == '\0';
  releaseRC(int_exp);
  releaseRC(exp_str_obj);
  if (!exponent_fits)
    panic("Real exponent too large");

  // Binary exponentiation.
  Integer *one = integerFromDigit(1);
  Integer *zero = integerFromDigit(0);
  Real *result = binary_bits ? realBinaryFromSigExp(one, zero, binary_bits)
                             : realWithSigExp(one, zero, result_precision,
                                              base->scale_precision);
  Real *b = retainRC(base);

  for (unsigned long long exp_rem = e; exp_rem > 0; exp_rem >>= 1) {
    if (exp_rem & 1) {
      Real *nr = binary_bits ? Real¸multiplyBinary(result, b, binary_bits)
                             : Real¸multiply(result, b, result_precision);
      releaseRC(result);
      result = nr;
    }
    if (exp_rem >> 1 > 0) {
      Real *nb = binary_bits ? Real¸multiplyBinary(b, b, binary_bits)
                             : Real¸multiply(b, b, result_precision);
      releaseRC(b);
      b = nb;
    }
  }

  releaseRC(b);
  if (negative_exponent) {
    Integer *one = integerFromDigit(1);
    Integer *zero = integerFromDigit(0);
    Real *numerator =
        binary_bits ? realBinaryFromSigExp(one, zero, binary_bits)
                    : realWithSigExp(one, zero, result_precision,
                                     base->scale_precision);
    Real *reciprocal =
        binary_bits ? Real¸divideBinary(numerator, result, binary_bits)
                    : Real¸divide(numerator, result, result_precision);
    releaseRC(numerator);
    releaseRC(result);
    result = reciprocal;
  }
  return result;
}

static int compareTernaryScale(Real *left, Real *right);

__attribute__((visibility("default"))) int Real¸compare(Real *left,
                                                        Real *right) {
  if (left->grid_base == 3 || right->grid_base == 3)
    return compareTernaryScale(left, right);
  String *left_string = Integer·toStringRC(left->significand);
  String *right_string = Integer·toStringRC(right->significand);
  const char *left_raw = String·toCString(left_string);
  const char *right_raw = String·toCString(right_string);
  int left_sign = left_raw[0] == '-' ? -1 : strcmp(left_raw, "0") == 0 ? 0 : 1;
  int right_sign =
      right_raw[0] == '-' ? -1 : strcmp(right_raw, "0") == 0 ? 0 : 1;
  if (left_sign != right_sign) {
    releaseRC(left_string);
    releaseRC(right_string);
    return left_sign < right_sign ? -1 : 1;
  }
  if (left_sign == 0) {
    releaseRC(left_string);
    releaseRC(right_string);
    return 0;
  }

  const char *left_digits = left_sign < 0 ? left_raw + 1 : left_raw;
  const char *right_digits = right_sign < 0 ? right_raw + 1 : right_raw;
  Integer *left_length = integerFromSize(strlen(left_digits));
  Integer *right_length = integerFromSize(strlen(right_digits));
  Integer *left_order = Integer¸add(left->exponent10, left_length);
  Integer *right_order = Integer¸add(right->exponent10, right_length);
  int order = compareIntegers(left_order, right_order);
  releaseRC(left_length);
  releaseRC(right_length);
  releaseRC(left_order);
  releaseRC(right_order);
  releaseRC(left_string);
  releaseRC(right_string);
  if (order != 0)
    return left_sign < 0 ? -order : order;

  Integer *ls;
  Integer *rs;
  Integer *exp;
  alignExponents(left, right, &ls, &rs, &exp);
  int result = compareIntegers(ls, rs);
  releaseRC(ls);
  releaseRC(rs);
  releaseRC(exp);
  return result;
}

// ---------------------------------------------------------------------------
// Arbitrary-precision binary reals
// ---------------------------------------------------------------------------

static Integer *integerPow(digit_t base, size_t n) {
  Integer *b = integerFromDigit(base);
  Integer *e = integerFromSize(n);
  Integer *result = Integer¸power(b, e);
  releaseRC(b);
  releaseRC(e);
  return result;
}

// Number of bits of a positive Integer.
static size_t bitLength(Integer *magnitude) {
  size_t digits = integerDigitCount(magnitude);
  size_t bits = (size_t)((double)(digits - 1) * 3.32192809488736);
  if (bits == 0)
    bits = 1;
  for (;; bits++) {
    Integer *limit = integerPow(2, bits);
    int order = compareIntegers(magnitude, limit);
    releaseRC(limit);
    if (order < 0)
      return bits;
  }
}

static Real *realBinaryFromSigExp(Integer *sig, Integer *exp, size_t bits) {
  normalize(&sig, &exp);
  return allocInitRC(Real, 0, __rc_ISOLATED, .significand = sig,
                     .exponent10 = exp, .precision = bits,
                     .scale_precision = false, .string_cache = NULL,
                     .cache_valid = false, .binary_bits = bits);
}

// Rounds (numerator / denominator) × 10^exponent10 to `bits` significant
// binary digits (ties-to-even) and returns the exact decimal value of the
// result. The denominator must be positive.
static Real *realFromRational(Integer *numerator, Integer *denominator,
                              Integer *exponent10, size_t bits) {
  if (bits == 0)
    panic("Invalid real precision");
  if (integerIsZero(numerator))
    return realBinaryFromSigExp(retainRC(&Integer¸zero),
                                retainRC(&Integer¸zero), bits);

  bool negative = integerIsNegative(numerator);
  Integer *top = integerAbs(numerator);
  Integer *bottom = retainRC(denominator);

  size_t scale10;
  if (integerIsNegative(exponent10)) {
    Integer *magnitude = integerAbs(exponent10);
    if (!integerToSize(magnitude, &scale10))
      panic("Real operation requires more memory than available");
    releaseRC(magnitude);
    Integer *factor = integerPow(10, scale10);
    Integer *next = Integer¸multiply(bottom, factor);
    releaseRC(factor);
    releaseRC(bottom);
    bottom = next;
  } else {
    if (!integerToSize(exponent10, &scale10))
      panic("Real operation requires more memory than available");
    Integer *factor = integerPow(10, scale10);
    Integer *next = Integer¸multiply(top, factor);
    releaseRC(factor);
    releaseRC(top);
    top = next;
  }

  // Scale by 2^k so the integer quotient has at least bits + 2 bits.
  long top_digits = (long)integerDigitCount(top);
  long bottom_digits = (long)integerDigitCount(bottom);
  long k = (long)bits + 4 - (long)((double)(top_digits - 1) * 3.32192809488736) +
           (long)((double)bottom_digits * 3.32192809488736) + 2;
  if (k >= 0) {
    Integer *factor = integerPow(2, (size_t)k);
    Integer *next = Integer¸multiply(top, factor);
    releaseRC(factor);
    releaseRC(top);
    top = next;
  } else {
    Integer *factor = integerPow(2, (size_t)-k);
    Integer *next = Integer¸multiply(bottom, factor);
    releaseRC(factor);
    releaseRC(bottom);
    bottom = next;
  }

  Integer *quotient = Integer¸floorDivide(top, bottom);
  Integer *remainder = Integer¸modulus(top, bottom);
  size_t quotient_bits = bitLength(quotient);
  size_t drop = quotient_bits - bits;
  Integer *drop_divisor = integerPow(2, drop);
  Integer *kept = Integer¸floorDivide(quotient, drop_divisor);
  Integer *discarded = Integer¸modulus(quotient, drop_divisor);
  Integer *half = integerPow(2, drop - 1);
  int order = compareIntegers(discarded, half);
  Integer *two = integerFromDigit(2);
  Integer *parity = Integer¸modulus(kept, two);
  bool round_up = order > 0 || (order == 0 && (!integerIsZero(remainder) ||
                                               !integerIsZero(parity)));
  if (round_up) {
    Integer *next = integerIncrement(kept);
    releaseRC(kept);
    kept = next;
  }

  // value = kept × 2^(drop - k); convert to an exact decimal.
  long e2 = (long)drop - k;
  Integer *sig;
  Integer *exp;
  if (e2 >= 0) {
    Integer *factor = integerPow(2, (size_t)e2);
    sig = Integer¸multiply(kept, factor);
    releaseRC(factor);
    exp = retainRC(&Integer¸zero);
  } else {
    Integer *factor = integerPow(5, (size_t)-e2);
    sig = Integer¸multiply(kept, factor);
    releaseRC(factor);
    exp = Integer¸fromInt64(e2);
  }
  if (negative)
    Integer·toggleSign(sig);

  releaseRC(top);
  releaseRC(bottom);
  releaseRC(quotient);
  releaseRC(remainder);
  releaseRC(drop_divisor);
  releaseRC(kept);
  releaseRC(discarded);
  releaseRC(half);
  releaseRC(two);
  releaseRC(parity);
  return realBinaryFromSigExp(sig, exp, bits);
}

__attribute__((visibility("default")))
Real *Real¸roundBinary(Real *value, size_t bits) {
  Integer *one = integerFromDigit(1);
  Real *result =
      realFromRational(value->significand, one, value->exponent10, bits);
  releaseRC(one);
  return result;
}

static Real *roundExact(Real *exact, size_t bits) {
  Real *result = Real¸roundBinary(exact, bits);
  releaseRC(exact);
  return result;
}

static String *formatBinaryReal(Real *self) {
  size_t digits = integerDigitCount(self->significand);
  // Shortest decimal that reads back as the same binary value.
  for (size_t count = 1; count < digits; count++) {
    Integer *sig = retainRC(self->significand);
    Integer *exp = retainRC(self->exponent10);
    roundToPrecision(&sig, &exp, count, false);
    Integer *one = integerFromDigit(1);
    Real *candidate = realFromRational(sig, one, exp, self->binary_bits);
    releaseRC(one);
    bool same = Real¸compare(candidate, self) == 0;
    releaseRC(candidate);
    if (same) {
      normalize(&sig, &exp);
      String *text = formatReal(sig, exp);
      releaseRC(sig);
      releaseRC(exp);
      return text;
    }
    releaseRC(sig);
    releaseRC(exp);
  }
  return formatReal(self->significand, self->exponent10);
}

__attribute__((visibility("default")))
Real *Real¸fromStringBinary(const char *value, size_t bits) {
  return roundExact(realFromStringExact(value), bits);
}

__attribute__((visibility("default")))
Real *Real¸fromIntegerBinary(Integer *value, size_t bits) {
  Integer *one = integerFromDigit(1);
  Real *result = realFromRational(value, one, &Integer¸zero, bits);
  releaseRC(one);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸fromInt64Binary(int64_t value, size_t bits) {
  Integer *integer = Integer¸fromInt64(value);
  Real *result = Real¸fromIntegerBinary(integer, bits);
  releaseRC(integer);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸addBinary(Real *left, Real *right, size_t bits) {
  return roundExact(Real¸add(left, right, SIZE_MAX), bits);
}

__attribute__((visibility("default")))
Real *Real¸subtractBinary(Real *left, Real *right, size_t bits) {
  return roundExact(Real¸subtract(left, right, SIZE_MAX), bits);
}

__attribute__((visibility("default")))
Real *Real¸multiplyBinary(Real *left, Real *right, size_t bits) {
  return roundExact(Real¸multiply(left, right, SIZE_MAX), bits);
}

__attribute__((visibility("default")))
Real *Real¸divideBinary(Real *dividend, Real *divisor, size_t bits) {
  if (integerIsZero(divisor->significand))
    panic("Division by zero!");
  Integer *numerator = retainRC(dividend->significand);
  Integer *denominator = retainRC(divisor->significand);
  if (integerIsNegative(denominator)) {
    Integer *negated = Integer¸subtract(&Integer¸zero, numerator);
    releaseRC(numerator);
    numerator = negated;
    Integer *magnitude = integerAbs(denominator);
    releaseRC(denominator);
    denominator = magnitude;
  }
  Integer *exponent =
      Integer¸subtract(dividend->exponent10, divisor->exponent10);
  Real *result = realFromRational(numerator, denominator, exponent, bits);
  releaseRC(numerator);
  releaseRC(denominator);
  releaseRC(exponent);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸powerBinary(Real *base, Real *exponent, size_t bits) {
  return powerImpl(base, exponent, bits, bits);
}

#define DEFINE_IEEE_ARITHMETIC(type, pow_fn, add_name, subtract_name,         \
                                multiply_name, divide_name, power_name)       \
  __attribute__((visibility("default"))) type add_name(type left, type right) {\
    volatile type result = left + right;                                      \
    if (!isfinite(result))                                                    \
      panic("IEEE real result is outside its finite range");                \
    return result;                                                            \
  }                                                                           \
  __attribute__((visibility("default"))) type subtract_name(type left,        \
                                                              type right) {   \
    volatile type result = left - right;                                      \
    if (!isfinite(result))                                                    \
      panic("IEEE real result is outside its finite range");                \
    return result;                                                            \
  }                                                                           \
  __attribute__((visibility("default"))) type multiply_name(type left,        \
                                                              type right) {   \
    volatile type result = left * right;                                      \
    if (!isfinite(result))                                                    \
      panic("IEEE real result is outside its finite range");                \
    return result;                                                            \
  }                                                                           \
  __attribute__((visibility("default"))) type divide_name(type left,          \
                                                            type right) {     \
    volatile type result = left / right;                                      \
    if (!isfinite(result))                                                    \
      panic("IEEE real result is outside its finite range");                \
    return result;                                                            \
  }                                                                           \
  __attribute__((visibility("default"))) type power_name(type base,           \
                                                           type exponent) {   \
    volatile type result = pow_fn(base, exponent);                            \
    if (!isfinite(result))                                                    \
      panic("IEEE real result is outside its finite range");                \
    return result;                                                            \
  }

DEFINE_IEEE_ARITHMETIC(float, powf, Real32¸add, Real32¸subtract,
                       Real32¸multiply, Real32¸divide, Real32¸power)
DEFINE_IEEE_ARITHMETIC(double, pow, Real64¸add, Real64¸subtract,
                       Real64¸multiply, Real64¸divide, Real64¸power)

#ifdef __FLT16_MANT_DIG__
static _Float16 powHalf(_Float16 base, _Float16 exponent) {
  return (_Float16)powf((float)base, (float)exponent);
}
DEFINE_IEEE_ARITHMETIC(_Float16, powHalf, Real16¸add, Real16¸subtract,
                       Real16¸multiply, Real16¸divide, Real16¸power)
#endif

static bool roundsToHalf(double parsed, double value) {
#ifdef __FLT16_MANT_DIG__
  return (_Float16)parsed == (_Float16)value;
#else
  (void)parsed;
  (void)value;
  panic("binary16 is not supported on this platform");
  return false;
#endif
}

__attribute__((visibility("default")))
double Real¸toBinary(Real *value) {
  return strtod(Real·toString(value), NULL);
}

__attribute__((visibility("default")))
Real *Real¸fromBinary(double value, unsigned significand_bits) {
  if (!isfinite(value))
    panic("Cannot box a non-finite real");
  // Shortest decimal that reads back as the same binary value.
  char text[64];
  // Digits needed to round-trip: ceil(1 + bits * log10(2))
  int max_digits = significand_bits <= 11 ? 5 : significand_bits <= 24 ? 9 : 17;
  for (int digits = 1; digits <= max_digits; digits++) {
    snprintf(text, sizeof text, "%.*e", digits - 1, value);
    double parsed = strtod(text, NULL);
    bool same = significand_bits <= 11   ? roundsToHalf(parsed, value)
                : significand_bits <= 24 ? strtof(text, NULL) == (float)value
                                         : parsed == value;
    if (same || digits == max_digits) {
      char mantissa[48];
      int exponent;
      if (sscanf(text, "%47[^e]e%d", mantissa, &exponent) != 2)
        panic("Failed to format binary real");
      char normalized[96];
      snprintf(normalized, sizeof normalized, "%se%d", mantissa, exponent);
      return Real¸fromString(normalized, (size_t)digits, false);
    }
  }
  panic("Failed to format binary real");
  return NULL;
}

// ---------------------------------------------------------------------------
// `scale n` reals on a binary or ternary grid
// ---------------------------------------------------------------------------

static Integer *negateInteger(Integer *value) {
  return Integer¸subtract(&Integer¸zero, value);
}

static Integer *integerPowerSize(Integer *exponent) {
  size_t n;
  if (!integerToSize(exponent, &n))
    panic("Real operation requires more memory than available");
  return integerPow(10, n);
}

// value = p / q with q > 0.
static void rationalOf(Real *x, Integer **p, Integer **q) {
  if (x->grid_base == 3) {
    *p = retainRC(x->significand);
    *q = integerPow(3, x->precision);
  } else if (integerIsNegative(x->exponent10)) {
    Integer *magnitude = integerAbs(x->exponent10);
    *p = retainRC(x->significand);
    *q = integerPowerSize(magnitude);
    releaseRC(magnitude);
  } else {
    Integer *factor = integerPowerSize(x->exponent10);
    *p = Integer¸multiply(x->significand, factor);
    *q = integerFromDigit(1);
    releaseRC(factor);
  }
}

// Rounds p / q (q > 0) to the nearest multiple of base^-n, ties to even.
static Real *roundToGrid(Integer *p, Integer *q, size_t n, unsigned base) {
  if (base != 2 && base != 3)
    panic("Unsupported real scale base");
  bool negative = integerIsNegative(p);
  Integer *magnitude = integerAbs(p);
  Integer *factor = integerPow(base, n);
  Integer *top = Integer¸multiply(magnitude, factor);
  Integer *kept = Integer¸floorDivide(top, q);
  Integer *remainder = Integer¸modulus(top, q);
  Integer *twice = Integer¸add(remainder, remainder);
  int order = compareIntegers(twice, q);
  Integer *two = integerFromDigit(2);
  Integer *parity = Integer¸modulus(kept, two);
  if (order > 0 || (order == 0 && !integerIsZero(parity))) {
    Integer *next = integerIncrement(kept);
    releaseRC(kept);
    kept = next;
  }
  if (negative && !integerIsZero(kept))
    Integer·toggleSign(kept);
  releaseRC(magnitude);
  releaseRC(factor);
  releaseRC(top);
  releaseRC(remainder);
  releaseRC(twice);
  releaseRC(two);
  releaseRC(parity);

  Integer *sig = kept;
  Integer *exp = retainRC(&Integer¸zero);
  if (base == 2 && n > 0) {
    Integer *fives = integerPow(5, n);
    sig = Integer¸multiply(kept, fives);
    releaseRC(fives);
    releaseRC(kept);
    releaseRC(exp);
    exp = Integer¸fromInt64(-(int64_t)n);
    normalize(&sig, &exp);
  }
  return allocInitRC(Real, 0, __rc_ISOLATED, .significand = sig,
                     .exponent10 = exp, .precision = n,
                     .scale_precision = true, .string_cache = NULL,
                     .cache_valid = false, .binary_bits = 0,
                     .grid_base = base);
}

static Real *gridFromReal(Real *value, size_t n, unsigned base) {
  Integer *p;
  Integer *q;
  rationalOf(value, &p, &q);
  Real *result = roundToGrid(p, q, n, base);
  releaseRC(p);
  releaseRC(q);
  return result;
}

static Real *gridFromDecimal(Integer *sig, Integer *exp, size_t n,
                             unsigned base) {
  Real decimal = {.significand = sig, .exponent10 = exp, .grid_base = 0};
  return gridFromReal(&decimal, n, base);
}

static int compareTernaryScale(Real *left, Real *right) {
  Integer *lp;
  Integer *lq;
  Integer *rp;
  Integer *rq;
  rationalOf(left, &lp, &lq);
  rationalOf(right, &rp, &rq);
  Integer *a = Integer¸multiply(lp, rq);
  Integer *b = Integer¸multiply(rp, lq);
  int result = compareIntegers(a, b);
  releaseRC(a);
  releaseRC(b);
  releaseRC(lp);
  releaseRC(lq);
  releaseRC(rp);
  releaseRC(rq);
  return result;
}

static String *formatTernaryScale(Real *self) {
  if (integerIsZero(self->significand))
    return formatReal(self->significand, self->exponent10);
  // Shortest decimal that rounds back to the same grid point.
  size_t places = (size_t)ceil((double)self->precision * 0.4771212547196624) + 4;
  Integer *q = integerPow(3, self->precision);
  bool negative = integerIsNegative(self->significand);
  Integer *magnitude = integerAbs(self->significand);
  Integer *factor = integerPow(10, places);
  Integer *top = Integer¸multiply(magnitude, factor);
  Integer *sig = Integer¸floorDivide(top, q);
  Integer *remainder = Integer¸modulus(top, q);
  Integer *twice = Integer¸add(remainder, remainder);
  if (compareIntegers(twice, q) >= 0) {
    Integer *next = integerIncrement(sig);
    releaseRC(sig);
    sig = next;
  }
  if (negative)
    Integer·toggleSign(sig);
  Integer *exp = Integer¸fromInt64(-(int64_t)places);
  releaseRC(q);
  releaseRC(magnitude);
  releaseRC(factor);
  releaseRC(top);
  releaseRC(remainder);
  releaseRC(twice);

  size_t digits = integerDigitCount(sig);
  for (size_t count = 1; count < digits; count++) {
    Integer *candidate_sig = retainRC(sig);
    Integer *candidate_exp = retainRC(exp);
    roundToPrecision(&candidate_sig, &candidate_exp, count, false);
    Real *candidate =
        gridFromDecimal(candidate_sig, candidate_exp, self->precision, 3);
    bool same = compareTernaryScale(candidate, self) == 0;
    releaseRC(candidate);
    if (same) {
      normalize(&candidate_sig, &candidate_exp);
      String *text = formatReal(candidate_sig, candidate_exp);
      releaseRC(candidate_sig);
      releaseRC(candidate_exp);
      releaseRC(sig);
      releaseRC(exp);
      return text;
    }
    releaseRC(candidate_sig);
    releaseRC(candidate_exp);
  }
  normalize(&sig, &exp);
  String *text = formatReal(sig, exp);
  releaseRC(sig);
  releaseRC(exp);
  return text;
}

__attribute__((visibility("default")))
Real *Real¸roundScale(Real *value, size_t n, unsigned base) {
  return gridFromReal(value, n, base);
}

__attribute__((visibility("default")))
Real *Real¸fromStringScale(const char *value, size_t n, unsigned base) {
  Real *exact = realFromStringExact(value);
  Real *result = gridFromReal(exact, n, base);
  releaseRC(exact);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸fromIntegerScale(Integer *value, size_t n, unsigned base) {
  return gridFromDecimal(value, &Integer¸zero, n, base);
}

__attribute__((visibility("default")))
Real *Real¸fromInt64Scale(int64_t value, size_t n, unsigned base) {
  Integer *integer = Integer¸fromInt64(value);
  Real *result = Real¸fromIntegerScale(integer, n, base);
  releaseRC(integer);
  return result;
}

typedef enum { SCALE_ADD, SCALE_SUB, SCALE_MUL, SCALE_DIV } ScaleOp;

static Real *scaleOperation(ScaleOp op, Real *left, Real *right, size_t n,
                            unsigned base) {
  Integer *lp;
  Integer *lq;
  Integer *rp;
  Integer *rq;
  rationalOf(left, &lp, &lq);
  rationalOf(right, &rp, &rq);
  Integer *p;
  Integer *q;
  switch (op) {
  case SCALE_ADD:
  case SCALE_SUB: {
    Integer *a = Integer¸multiply(lp, rq);
    Integer *b = Integer¸multiply(rp, lq);
    p = op == SCALE_ADD ? Integer¸add(a, b) : Integer¸subtract(a, b);
    q = Integer¸multiply(lq, rq);
    releaseRC(a);
    releaseRC(b);
    break;
  }
  case SCALE_MUL:
    p = Integer¸multiply(lp, rp);
    q = Integer¸multiply(lq, rq);
    break;
  case SCALE_DIV:
    if (integerIsZero(rp))
      panic("Division by zero!");
    p = Integer¸multiply(lp, rq);
    q = Integer¸multiply(lq, rp);
    if (integerIsNegative(q)) {
      Integer *np = negateInteger(p);
      Integer *nq = negateInteger(q);
      releaseRC(p);
      releaseRC(q);
      p = np;
      q = nq;
    }
    break;
  }
  Real *result = roundToGrid(p, q, n, base);
  releaseRC(p);
  releaseRC(q);
  releaseRC(lp);
  releaseRC(lq);
  releaseRC(rp);
  releaseRC(rq);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸addScale(Real *left, Real *right, size_t n, unsigned base) {
  return scaleOperation(SCALE_ADD, left, right, n, base);
}

__attribute__((visibility("default")))
Real *Real¸subtractScale(Real *left, Real *right, size_t n, unsigned base) {
  return scaleOperation(SCALE_SUB, left, right, n, base);
}

__attribute__((visibility("default")))
Real *Real¸multiplyScale(Real *left, Real *right, size_t n, unsigned base) {
  return scaleOperation(SCALE_MUL, left, right, n, base);
}

__attribute__((visibility("default")))
Real *Real¸divideScale(Real *dividend, Real *divisor, size_t n, unsigned base) {
  return scaleOperation(SCALE_DIV, dividend, divisor, n, base);
}

__attribute__((visibility("default")))
Real *Real¸powerScale(Real *value, Real *exponent, size_t n, unsigned base) {
  Integer *ep;
  Integer *eq;
  rationalOf(exponent, &ep, &eq);
  bool negative = integerIsNegative(ep);
  Integer *magnitude = integerAbs(ep);
  Integer *remainder = Integer¸modulus(magnitude, eq);
  if (!integerIsZero(remainder))
    panic("Real exponentiation requires an integer exponent");
  Integer *whole = Integer¸floorDivide(magnitude, eq);
  size_t e;
  if (!integerToSize(whole, &e))
    panic("Real exponent too large");
  releaseRC(ep);
  releaseRC(eq);
  releaseRC(magnitude);
  releaseRC(remainder);
  releaseRC(whole);

  Real *result = Real¸fromInt64Scale(1, n, base);
  Real *b = retainRC(value);
  for (size_t rest = e; rest > 0; rest >>= 1) {
    if (rest & 1) {
      Real *next = scaleOperation(SCALE_MUL, result, b, n, base);
      releaseRC(result);
      result = next;
    }
    if (rest >> 1 > 0) {
      Real *next = scaleOperation(SCALE_MUL, b, b, n, base);
      releaseRC(b);
      b = next;
    }
  }
  releaseRC(b);
  if (negative) {
    Real *one = Real¸fromInt64Scale(1, n, base);
    Real *reciprocal = scaleOperation(SCALE_DIV, one, result, n, base);
    releaseRC(one);
    releaseRC(result);
    result = reciprocal;
  }
  return result;
}

// Exact value as a reduced fraction "numerator/denominator".
__attribute__((visibility("default"))) String *Real¸toFraction(Real *value) {
  Integer *p;
  Integer *q;
  rationalOf(value, &p, &q);
  Integer *a = integerAbs(p);
  Integer *b = retainRC(q);
  while (!integerIsZero(b)) {
    Integer *next = Integer¸modulus(a, b);
    releaseRC(a);
    a = b;
    b = next;
  }
  // a is now the gcd (or q when p is zero, giving 0/1).
  Integer *magnitude = integerAbs(p);
  Integer *numerator = Integer¸floorDivide(magnitude, a);
  releaseRC(magnitude);
  Integer *denominator = Integer¸floorDivide(q, a);
  if (integerIsNegative(p))
    Integer·toggleSign(numerator);
  String *left = Integer·toStringRC(numerator);
  String *right = Integer·toStringRC(denominator);
  String *slash = String¸fromCString("/");
  String *head = String¸concat(left, slash);
  String *result = String¸concat(head, right);
  releaseRC(left);
  releaseRC(right);
  releaseRC(slash);
  releaseRC(head);
  releaseRC(numerator);
  releaseRC(denominator);
  releaseRC(p);
  releaseRC(q);
  releaseRC(a);
  releaseRC(b);
  return result;
}

// ---------------------------------------------------------------------------
// Remainder: n - floor(n / d) * d, as for integers (ADR-023)
// ---------------------------------------------------------------------------

// Floored modulus of whole numbers; the result takes the sign of the divisor.
static Integer *floorModulus(Integer *n, Integer *d) {
  if (integerIsZero(d))
    panic("Division by zero!");
  Integer *dividend = integerAbs(n);
  Integer *divisor = integerAbs(d);
  Integer *m = Integer¸modulus(dividend, divisor);
  releaseRC(dividend);
  if (integerIsNegative(n) != integerIsNegative(d) && !integerIsZero(m)) {
    Integer *flipped = Integer¸subtract(divisor, m);
    releaseRC(m);
    m = flipped;
  }
  releaseRC(divisor);
  if (integerIsNegative(d) && !integerIsZero(m))
    Integer·toggleSign(m);
  return m;
}

// The remainder as m / q, where q > 0 is the common denominator.
static void remainderParts(Real *left, Real *right, Integer **m,
                           Integer **q) {
  Integer *lp;
  Integer *lq;
  Integer *rp;
  Integer *rq;
  rationalOf(left, &lp, &lq);
  rationalOf(right, &rp, &rq);
  Integer *a = Integer¸multiply(lp, rq);
  Integer *b = Integer¸multiply(rp, lq);
  *m = floorModulus(a, b);
  *q = Integer¸multiply(lq, rq);
  releaseRC(a);
  releaseRC(b);
  releaseRC(lp);
  releaseRC(lq);
  releaseRC(rp);
  releaseRC(rq);
}

__attribute__((visibility("default")))
Real *Real¸modulus(Real *left, Real *right, size_t result_precision) {
  Integer *ls;
  Integer *rs;
  Integer *exp;
  alignExponents(left, right, &ls, &rs, &exp);
  Integer *m = floorModulus(ls, rs);
  releaseRC(ls);
  releaseRC(rs);
  return realWithSigExp(m, exp, result_precision, left->scale_precision);
}

__attribute__((visibility("default")))
Real *Real¸modulusBinary(Real *left, Real *right, size_t bits) {
  Integer *m;
  Integer *q;
  remainderParts(left, right, &m, &q);
  Real *result = realFromRational(m, q, &Integer¸zero, bits);
  releaseRC(m);
  releaseRC(q);
  return result;
}

__attribute__((visibility("default")))
Real *Real¸modulusScale(Real *left, Real *right, size_t n, unsigned base) {
  Integer *m;
  Integer *q;
  remainderParts(left, right, &m, &q);
  Real *result = roundToGrid(m, q, n, base);
  releaseRC(m);
  releaseRC(q);
  return result;
}

#define DEFINE_IEEE_MODULUS(type, fmod_fn, name)                              \
  __attribute__((visibility("default"))) type name(type left, type right) {   \
    if (right == 0)                                                           \
      panic("Division by zero!");                                             \
    volatile type result = fmod_fn(left, right);                              \
    if (result != 0 && (result < 0) != (right < 0))                           \
      result = result + right;                                                \
    return result;                                                            \
  }

DEFINE_IEEE_MODULUS(float, fmodf, Real32¸modulus)
DEFINE_IEEE_MODULUS(double, fmod, Real64¸modulus)
#ifdef __FLT16_MANT_DIG__
static _Float16 fmodHalf(_Float16 left, _Float16 right) {
  return (_Float16)fmodf((float)left, (float)right);
}
DEFINE_IEEE_MODULUS(_Float16, fmodHalf, Real16¸modulus)
#endif
