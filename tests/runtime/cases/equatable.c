#include "runtime.h"
#include <stdio.h>

// ```clawr
// data DataStructure {
//     value: integer @range(0..255)
// }
// ```
typedef struct DataStructure {
  __rc_header header;
  u_int8_t value;
} DataStructure;

typedef struct DataStructureˇfields {
  int8_t value;
} DataStructureˇfields;

static truthvalue_t DataStructure·equals(void *left, void *right) {
  return ((DataStructure *)left)->value == ((DataStructure *)right)->value
             ? c_true
             : c_false;
}

static const clawr¸Equatableˇwitness DataStructureˇclawr¸Equatableˇwitness = {
    .equal = DataStructure·equals,
};
__protocol_conformance_entry DataStructureˇclawr¸Equatableˇconformance = {
    .protocol = &clawr¸Equatableˇtype,
    .witness_table = &DataStructureˇclawr¸Equatableˇwitness,
};
static __type_info DataStructureˇtype = {
    .data_type =
        {
            .size = sizeof(DataStructure),
            .conformances =
                (const __protocol_conformance_entry *[]){
                    &DataStructureˇclawr¸Equatableˇconformance,
                    NULL,
                },
        },
};

int main() {
  DataStructure *a =
      (DataStructure *)allocInitRC(DataStructure, 0, __rc_ISOLATED, .value = 0);
  DataStructure *b =
      (DataStructure *)allocInitRC(DataStructure, 0, __rc_ISOLATED, .value = 0);
  DataStructure *c =
      (DataStructure *)allocInitRC(DataStructure, 0, __rc_ISOLATED, .value = 1);

  const clawr¸Equatableˇwitness *witness =
      CONFORMANCE_ENTRY(a, clawr¸Equatable);
  truthvalue_t aIsB = witness->equal(a, b);
  truthvalue_t aIsC = witness->equal(a, c);
  printTruthvalue(aIsB);
  printTruthvalue(aIsC);

  releaseRC(a);
  releaseRC(b);
  releaseRC(c);
}
