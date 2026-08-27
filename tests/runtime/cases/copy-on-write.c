#include "data_structure.h"
#include <stdio.h>

int main() {
  // Clawr: `mut original = DataStructure { x: 47, y: 42 }`
  DataStructure *original =
      allocInitRC(DataStructure, 0, __rc_ISOLATED, .x = 47, .y = 42);

  // Clawr: `const isolated = original`
  DataStructure *isolated = retainRC(original);

  // Clawr: `original.x = 2`
  mutateRC(original);
  original->fields.x = 2;

  printf("modified: %d, %d\n", original->fields.x, original->fields.y);
  printf("isolated: %d, %d\n", isolated->fields.x, isolated->fields.y);

  releaseRC(original);
  releaseRC(isolated);
}
