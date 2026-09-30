#include "real.h"
#include <stdio.h>

int main() {
  // Test basic division: 10.0 / 2.5 = 4.0
  Real *dividend = Real¸fromString("10.0");
  Real *divisor = Real¸fromString("2.5");
  Real *result = Real¸divide(dividend, divisor);
  printf("10.0 / 2.5 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test division with large multi-digit divisor: 100.0 / 12.5 = 8.0
  dividend = Real¸fromString("100.0");
  divisor = Real¸fromString("12.5");
  result = Real¸divide(dividend, divisor);
  printf("100.0 / 12.5 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test division with fractional result: 7.0 / 3.0 ≈ 2.33...
  dividend = Real¸fromString("7.0");
  divisor = Real¸fromString("3.0");
  result = Real¸divide(dividend, divisor);
  printf("7.0 / 3.0 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test division with small divisor: 1.0 / 0.02 = 50.0
  dividend = Real¸fromString("1.0");
  divisor = Real¸fromString("0.02");
  result = Real¸divide(dividend, divisor);
  printf("1.0 / 0.02 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test negative division: -8.0 / 2.0 = -4.0
  dividend = Real¸fromString("-8.0");
  divisor = Real¸fromString("2.0");
  result = Real¸divide(dividend, divisor);
  printf("-8.0 / 2.0 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  return 0;
}
