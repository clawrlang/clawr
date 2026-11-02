#include "integer.h"
#include <stdio.h>

int main() {
  Integer *a = Integer¸fromCString(
      "1000000000000000055511151231257827021181583404541015625");
  Integer *b = Integer¸fromCString(
      "200000000000000011102230246251565404236316680908203125");
  Integer *product = Integer¸multiply(a, b);
  printf("%s\n", Integer·toString(a));
  printf("%s\n", Integer·toString(product));
  Integer *negated = Integer¸subtract(&Integer¸zero, product);
  printf("%s\n", Integer·toString(negated));
  return 0;
}
