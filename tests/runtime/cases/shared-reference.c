#include "data_structure.h"
#include <stdio.h>

int main() {
    // Clawr: `ref original = Struct { x: 47, y: 42 }`
    DataStructure* original = allocInitRC(DataStructure, 0, __rc_SHARED,
        .x = 47,
        .y = 42
    );

    // Clawr: `ref isolated = original`
    DataStructure* reference = retainRC(original);

    // Clawr: `original.x = 2`
    mutateRC(original);
    original->fields.x = 2;

    printf("modified: %d, %d\n", original->fields.x, original->fields.y);
    printf("reference: %d, %d\n", reference->fields.x, reference->fields.y);

    releaseRC(original);
    releaseRC(reference);
}
