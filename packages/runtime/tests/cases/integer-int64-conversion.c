#include "runtime.h"
#include <stdio.h>

int main() {
  int64_t values[] = {0, 1, -1, INT64_MAX, -INT64_MAX};
  for (size_t i = 0; i < sizeof(values) / sizeof(values[0]); i++) {
    Integer *integer = Integer¸fromInt64(values[i]);
    printf("%s %lld\n", Integer·toString(integer),
           (long long)Integer·toInt64(integer));
    releaseRC(integer);
  }

  Integer *big = Integer¸fromCString("9223372036854775808");
  printf("%s\n", Integer·toString(big));
  releaseRC(big);
  return 0;
}
