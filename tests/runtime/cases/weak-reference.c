#include "data_structure.h"
#include <stdio.h>

void printReference(__rc_proxy* proxy) {
    DataStructure* reference = proxy->target;
    if (reference == NULL)
        printf("weak reference is NULL\n");
    else
        printf("weak reference: %d\n", reference->fields.x);
}

int main() {
    // Clawr: `ref original = DataStructure { x: 47 }`
    DataStructure* original = allocRC(DataStructure, __rc_SHARED);
    original->fields.x = 47;

    // Clawr: `weak ref isolated = original`
    void* proxy = retainWeakly(original);

    printReference(proxy);
    releaseRC(original);
    printReference(proxy);

    releaseProxy(proxy);
}
