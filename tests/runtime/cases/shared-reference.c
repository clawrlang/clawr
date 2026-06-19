#include "data_structure.h"
#include <stdio.h>

int main() {
    // Clawr: `ref original = Struct { x: 47, y: 42 }`
    DataStructure* original = allocRC(DataStructure, __rc_SHARED);
    memcpy(((__rc_header*)original) + 1, &(DataStructureˇfields) {
        .x = 47,
        .y = 42,
    }, sizeof(DataStructure) - sizeof(__rc_header));

    // Clawr: `ref isolated = original`
    DataStructure* reference = retainRC(original);

    // Clawr: `original.x = 2`
    mutateRC(original);
    original->x = 2;

    printf("modified: %d, %d\n", original->x, original->y);
    printf("reference: %d, %d\n", reference->x, reference->y);

    releaseRC(original);
    releaseRC(reference);
}
