#include "runtime.h"
#include <stdio.h>

static void check(const char *dividend, const char *divisor) {
  Integer *n = Integer¸fromCString(dividend);
  Integer *d = Integer¸fromCString(divisor);
  Integer *q = Integer¸floorDivide(n, d);
  Integer *r = Integer¸modulus(n, d);
  printf("%s / %s = %s rem %s\n", dividend, divisor, Integer·toString(q),
         Integer·toString(r));
  releaseRC(n);
  releaseRC(d);
  releaseRC(q);
  releaseRC(r);
}

int main() {
  check("7", "2");
  check("-7", "2");
  check("7", "-2");
  check("-7", "-2");
  check("-6", "3");
  check("0", "5");
  check("-340282366920938463426481119284349108225", "18446744073709551616");
  printf("%lld %lld\n", (long long)floorDiv64(-7, 2), (long long)floorMod64(-7, 2));
  printf("%lld %lld\n", (long long)floorDiv64(7, -2), (long long)floorMod64(7, -2));
  return 0;
}
