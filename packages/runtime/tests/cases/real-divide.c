#include "real.h"
#include <stdio.h>

int main() {
  // Test basic division: 10.0 / 2.5 = 4.0
  Real *dividend = Real¸fromString("10.0", 50, false);
  Real *divisor = Real¸fromString("2.5", 50, false);
  Real *result = Real¸divide(dividend, divisor, 50);
  printf("10.0 / 2.5 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test division with large multi-digit divisor: 100.0 / 12.5 = 8.0
  dividend = Real¸fromString("100.0", 50, false);
  divisor = Real¸fromString("12.5", 50, false);
  result = Real¸divide(dividend, divisor, 50);
  printf("100.0 / 12.5 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test division with fractional result: 7.0 / 3.0 ≈ 2.33...
  dividend = Real¸fromString("7.0", 50, false);
  divisor = Real¸fromString("3.0", 50, false);
  result = Real¸divide(dividend, divisor, 50);
  printf("7.0 / 3.0 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test division with small divisor: 1.0 / 0.02 = 50.0
  dividend = Real¸fromString("1.0", 50, false);
  divisor = Real¸fromString("0.02", 50, false);
  result = Real¸divide(dividend, divisor, 50);
  printf("1.0 / 0.02 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Test negative division: -8.0 / 2.0 = -4.0
  dividend = Real¸fromString("-8.0", 50, false);
  divisor = Real¸fromString("2.0", 50, false);
  result = Real¸divide(dividend, divisor, 50);
  printf("-8.0 / 2.0 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  dividend = Real¸fromString("1.235", 2, false);
  divisor = Real¸fromString("1.0", 2, false);
  result = Real¸multiply(dividend, divisor, 2);
  printf("1.235 rounded to 2 significant digits = %s\n",
         Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  dividend = Real¸fromString("1.245", 2, true);
  divisor = Real¸fromString("1.0", 2, true);
  result = Real¸multiply(dividend, divisor, 2);
  printf("1.245 rounded to scale 2 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  dividend = Real¸fromString("0.0006", 2, true);
  divisor = Real¸fromString("1.0", 2, true);
  result = Real¸multiply(dividend, divisor, 2);
  printf("0.0006 rounded to scale 2 = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  dividend = Real¸fromString("1e10000000000", 3, false);
  divisor = Real¸fromString("1.0", 3, false);
  result = Real¸multiply(dividend, divisor, 3);
  printf("large real exponent = %s\n", Real·toString(result));
  printf("large real exponent comparison = %d\n",
         Real¸compare(result, divisor));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  printf("binary32 addition = %.1f\n", Real32¸add(1.0f, 2.0f));

  dividend = Real¸fromString("1.245", 4, false);
  result = Real¸round(dividend, 2);
  printf("real assignment rounding = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(result);

  dividend = Real¸fromString("2.0", 10, false);
  divisor = Real¸fromString("-2.0", 10, false);
  result = Real¸power(dividend, divisor, 10);
  printf("negative integer real power = %s\n", Real·toString(result));
  releaseRC(dividend);
  releaseRC(divisor);
  releaseRC(result);

  // Division keeps enough digits for correct rounding
  const char *divide_cases[][4] = {
      {"3.0", "1.25", "2", "s"}, {"2.00", "3.00", "3", "p"},
      {"-2.00", "3.00", "3", "p"}, {"1", "8", "2", "s"}};
  for (size_t i = 0; i < 4; i++) {
    bool scale = divide_cases[i][3][0] == 's';
    size_t digits = (size_t)atoi(divide_cases[i][2]);
    dividend = Real¸fromString(divide_cases[i][0], digits + 1, scale);
    divisor = Real¸fromString(divide_cases[i][1], digits + 1, scale);
    result = Real¸divide(dividend, divisor, digits);
    printf("%s / %s = %s\n", divide_cases[i][0], divide_cases[i][1],
           Real·toString(result));
    releaseRC(dividend);
    releaseRC(divisor);
    releaseRC(result);
  }

  return 0;
}
