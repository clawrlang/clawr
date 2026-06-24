#include "runtime.h"

// ```clawr
// data DataStructure {
//     value: integer @range(0..255)
// }
// ```
typedef struct DataStructureˇfields {
    int8_t x;
    int8_t y;
} DataStructureˇfields;

typedef struct DataStructure {
    __rc_header header;
    DataStructureˇfields fields;
} DataStructure;
static const __type_info DataStructureˇtype = {
    .data_type = { .size = sizeof(DataStructure) }
};
