#include "real.h"
#include <stdio.h>

static void show(const char *label, Real *value) {
  printf("%s = %s\n", label, Real·toString(value));
  releaseRC(value);
}

int main() {
  Real *a53 = Real¸fromStringBinary("0.1", 53);
  Real *b53 = Real¸fromStringBinary("0.2", 53);
  show("binary64 0.1 + 0.2", Real¸addBinary(a53, b53, 53));
  show("binary64 0.1 * 0.2", Real¸multiplyBinary(a53, b53, 53));
  releaseRC(a53);
  releaseRC(b53);

  Real *one = Real¸fromInt64Binary(1, 24);
  Real *three = Real¸fromInt64Binary(3, 24);
  show("binary32 1 / 3", Real¸divideBinary(one, three, 24));
  releaseRC(one);
  releaseRC(three);

  Real *one5 = Real¸fromInt64Binary(1, 5);
  Real *three5 = Real¸fromInt64Binary(3, 5);
  show("5 bits 1 / 3", Real¸divideBinary(one5, three5, 5));
  show("5 bits 3 - 1", Real¸subtractBinary(three5, one5, 5));
  releaseRC(one5);
  releaseRC(three5);

  Real *a113 = Real¸fromStringBinary("0.1", 113);
  Real *b113 = Real¸fromStringBinary("0.2", 113);
  show("binary128 0.1 + 0.2", Real¸addBinary(a113, b113, 113));
  show("binary128 0.1 * 0.2", Real¸multiplyBinary(a113, b113, 113));
  releaseRC(a113);
  releaseRC(b113);

  Real *wide = Real¸fromStringBinary("1.0000000001", 237);
  Real *exponent = Real¸fromInt64Binary(-3, 237);
  show("binary256 power", Real¸powerBinary(wide, exponent, 237));
  releaseRC(wide);
  releaseRC(exponent);

  Real *negative = Real¸fromStringBinary("-2.5", 8);
  Real *two = Real¸fromInt64Binary(2, 8);
  show("negative division", Real¸divideBinary(negative, two, 8));
  releaseRC(negative);
  releaseRC(two);
  return 0;
}
