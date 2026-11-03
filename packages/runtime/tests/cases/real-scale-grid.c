#include "real.h"
#include <stdio.h>

static void show(const char *label, Real *value) {
  printf("%s = %s\n", label, Real·toString(value));
  releaseRC(value);
}

int main() {
  Real *a2 = Real¸fromStringScale("0.1", 3, 2);
  Real *b2 = Real¸fromStringScale("0.3", 3, 2);
  show("bin scale 3: 0.1", Real¸roundScale(a2, 3, 2));
  show("bin scale 3: 0.1 + 0.3", Real¸addScale(a2, b2, 3, 2));
  show("bin scale 3: 0.1 * 0.3", Real¸multiplyScale(a2, b2, 3, 2));
  show("bin scale 3: 0.3 / 0.1", Real¸divideScale(b2, a2, 3, 2));
  show("bin scale 3: 0.3 ^ 2", Real¸powerScale(b2, Real¸fromInt64Scale(2, 3, 2), 3, 2));
  releaseRC(a2);
  releaseRC(b2);

  Real *a3 = Real¸fromStringScale("0.1", 3, 3);
  Real *b3 = Real¸fromStringScale("0.3", 3, 3);
  show("ter scale 3: 0.1", Real¸roundScale(a3, 3, 3));
  show("ter scale 3: 0.1 + 0.3", Real¸addScale(a3, b3, 3, 3));
  show("ter scale 3: 0.1 * 0.3", Real¸multiplyScale(a3, b3, 3, 3));
  show("ter scale 3: 0.3 / 0.1", Real¸divideScale(b3, a3, 3, 3));
  show("ter scale 3: 0.1 - 0.3", Real¸subtractScale(a3, b3, 3, 3));
  show("ter scale 3: 0.3 ^ -2", Real¸powerScale(b3, Real¸fromInt64Scale(-2, 3, 3), 3, 3));
  printf("compare %d %d\n", Real¸compare(a3, b3), Real¸compare(b3, a3));

  Real *third = Real¸divideScale(Real¸fromInt64Scale(1, 20, 3), Real¸fromInt64Scale(3, 20, 3), 20, 3);
  show("ter scale 20: 1 / 3", third);
  show("ter scale 5: -7", Real¸fromInt64Scale(-7, 5, 3));
  Real *neg = Real¸fromStringScale("-0.7", 5, 3);
  show("ter scale 5: -0.7", neg);
  releaseRC(a3);
  releaseRC(b3);
  return 0;
}
