#include "real.h"
#include <stdio.h>

static void show(const char *label, Real *value) {
  printf("%s = %s\n", label, Real·toString(value));
  releaseRC(value);
}

static Real *d(const char *text) { return Real¸fromString(text, 10, false); }

int main() {
  show("7.5 % 2", Real¸modulus(d("7.5"), d("2"), 10));
  show("-7.5 % 2", Real¸modulus(d("-7.5"), d("2"), 10));
  show("7.5 % -2", Real¸modulus(d("7.5"), d("-2"), 10));
  show("-7.5 % -2", Real¸modulus(d("-7.5"), d("-2"), 10));
  show("0.3 % 0.1", Real¸modulus(d("0.3"), d("0.1"), 10));
  show("1 % 3", Real¸modulus(d("1"), d("3"), 10));
  show("6 % 3", Real¸modulus(d("6"), d("3"), 10));

  Real *a = Real¸fromStringBinary("7.5", 24);
  Real *b = Real¸fromStringBinary("2", 24);
  show("bin 7.5 % 2", Real¸modulusBinary(a, b, 24));
  releaseRC(a);
  releaseRC(b);
  a = Real¸fromStringBinary("-0.1", 53);
  b = Real¸fromStringBinary("0.03", 53);
  show("bin64 -0.1 % 0.03", Real¸modulusBinary(a, b, 53));
  releaseRC(a);
  releaseRC(b);

  a = Real¸fromStringScale("1", 3, 3);
  b = Real¸fromStringScale("0.3", 3, 3);
  show("ter scale 3: 1 % 0.3", Real¸modulusScale(a, b, 3, 3));
  releaseRC(a);
  releaseRC(b);
  a = Real¸fromStringScale("-1.25", 3, 2);
  b = Real¸fromStringScale("0.5", 3, 2);
  show("bin scale 3: -1.25 % 0.5", Real¸modulusScale(a, b, 3, 2));
  releaseRC(a);
  releaseRC(b);

  printf("%g %g %g\n", Real64¸modulus(-7.5, 2), Real64¸modulus(7.5, -2),
         (double)Real32¸modulus(7.5f, 2.0f));
  return 0;
}
