#include "real.h"
#include <stdio.h>

static void show(const char *label, Real *value) {
  String *text = Real¸toFraction(value);
  printf("%s = %s\n", label, String·toCString(text));
  releaseRC(text);
  releaseRC(value);
}

int main() {
  show("ter scale 3: 0.04", Real¸fromStringScale("0.04", 3, 3));
  show("ter scale 3: 0.1", Real¸fromStringScale("0.1", 3, 3));
  show("ter scale 3: -0.3", Real¸fromStringScale("-0.3", 3, 3));
  show("bin scale 5: 0.15625", Real¸fromStringScale("0.15625", 5, 2));
  show("bin scale 3: 0.5", Real¸fromStringScale("0.5", 3, 2));
  show("ter scale 3: 0", Real¸fromStringScale("0", 3, 3));
  show("bin sig 24: 0.75", Real¸fromStringBinary("0.75", 24));
  show("dec: 2.5", Real¸fromString("2.5", 3, false));
  show("dec: 40", Real¸fromString("40", 3, false));
  return 0;
}
