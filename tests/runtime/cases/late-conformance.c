#include "runtime.h"
#include <stdio.h>

// ```clawr
// trait Describable {
//     func describe() -> string
// }
// ```
typedef struct Describableˇwitness {
    String* (*describe)(void* self);
} Describableˇwitness;
__trait_info Describableˇinfo = {
    .name = "Describable"
};

// ```clawr
// data DataStructure {
//     value: integer @range(0..255)
// }
// ```
typedef struct DataStructure {
    __rc_header header;
    u_int8_t x;
    u_int8_t y;
} DataStructure;

typedef struct DataStructureˇfields {
    int8_t x;
    int8_t y;
} DataStructureˇfields;
static __type_info DataStructureˇtype = {
    .data_type = { .size = sizeof(DataStructure) },
};

static String* DataStructure·describe(void* self) {
    DataStructure* fields = (DataStructure*)self;
    String* result = String¸fromCString("DataStructure { x: 1, y: 2 }");
    return result;
 }
static const Describableˇwitness DataStructureˇDescribableˇwitness = {
    .describe = DataStructure·describe,
};
__trait_conformance_entry Describableˇconformance = {
    .trait = &Describableˇinfo,
    .witness_table = &DataStructureˇDescribableˇwitness
};

__attribute__((constructor))
static void DataStructureˇregisterConformances(void) {
    ADD_CONFORMANCE_ENTRY(DataStructure, Describable);
}

int main() {
    DataStructure* ds = (DataStructure*)allocInitRC(DataStructure, 0, __rc_ISOLATED,
        .x = 42,
        .y = 255
    );

    const Describableˇwitness* describableWitness = CONFORMANCE_ENTRY(DataStructure, Describable);
    String* description = describableWitness->describe(ds);
    printf("%s\n", description->data);

    releaseRC(ds);
    releaseRC(description);
}
