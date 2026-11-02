#include "real.h"
#include <stdio.h>

int main() {
  Real *wide = Real¸fromString("340282346638528860000000000000000000000.0", 100, false);
  printf("%s\n", Real·toString(wide));
  Real *negative = Real¸fromString("-170141183460469231731687303715884105727", 100, false);
  printf("%s\n", Real·toString(negative));
  printf("%d\n", Real¸compare(negative, wide));
  return 0;
}
