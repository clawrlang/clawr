#include "runtime.h"

// ```clawr
// data DataStructure {
//     value: integer @range(0..255)
// }
// ```
typedef struct DataStructureˇproperties {
  int8_t x;
  int8_t y;
} DataStructureˇproperties;

typedef struct DataStructure {
  __rc_header header;
  DataStructureˇproperties properties;
} DataStructure;
static const __type_info DataStructureˇtype = {
    .data_type = {.size = sizeof(DataStructure)},
};
