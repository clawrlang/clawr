#include "data_structure.h"
#include <stdio.h>

int main() {
  // Clawr: `ref original = Struct { x: 47, y: 42 }`
  DataStructure *original =
      allocInitRC(DataStructure, 0, __rc_SHARED, .x = 47, .y = 42);

  // Clawr: `ref isolated = original`
  DataStructure *reference = retainRC(original);

  // Clawr: `original.x = 2`
  mutateRC(original);
  original->properties.x = 2;

  printf("modified: %d, %d\n", original->properties.x, original->properties.y);
  printf("reference: %d, %d\n", reference->properties.x,
         reference->properties.y);

  releaseRC(original);
  releaseRC(reference);
}
