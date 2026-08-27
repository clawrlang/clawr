#include "lanes.h"
#include <stdio.h>
#include <stdlib.h>

int main() {
  const BinaryWord a = BinaryWord¸fromCString("1100", 4);
  const BinaryWord b = BinaryWord¸fromCString("1010", 4);

  const BinaryWord cAnd = bitwiseAnd(a, b);
  const BinaryWord cOr = bitwiseOr(a, b);
  const BinaryWord cNot = bitwiseNot(a, 4);

  char *sAnd = BinaryWord·toCString(cAnd, 4);
  char *sOr = BinaryWord·toCString(cOr, 4);
  char *sNot = BinaryWord·toCString(cNot, 4);

  printf("%s\n", sAnd);
  printf("%s\n", sOr);
  printf("%s\n", sNot);

  free(sAnd);
  free(sOr);
  free(sNot);

  return 0;
}
