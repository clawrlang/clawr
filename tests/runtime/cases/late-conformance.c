#include "data_structure.h"
#include "runtime.h"
#include <stdio.h>

// ```clawr
// trait Describable {
//     func describe() -> string
// }
// ```
typedef struct Describableˇwitness {
  String *(*describe)(void *self);
} Describableˇwitness;
__protocol_info Describableˇtype = {.name = "Describable"};

static String *DataStructure·describe(void *self) {
  DataStructure *fields = (DataStructure *)self;
  String *result = String¸fromCString("DataStructure { x: 1, y: 2 }");
  return result;
}
static const Describableˇwitness DataStructureˇDescribableˇwitness = {
    .describe = DataStructure·describe,
};
__protocol_conformance_entry Describableˇconformance = {
    .protocol = &Describableˇtype,
    .witness_table = &DataStructureˇDescribableˇwitness};

__attribute__((constructor)) static void
DataStructureˇregisterConformances(void) {
  ADD_CONFORMANCE_ENTRY(DataStructure, Describable);
}

int main() {
  DataStructure *ds = (DataStructure *)allocInitRC(
      DataStructure, 0, __rc_ISOLATED, .x = 42, .y = 255);

  const Describableˇwitness *describableWitness =
      CONFORMANCE_ENTRY(ds, Describable);
  String *description = describableWitness->describe(ds);
  printf("%s\n", description->data);

  releaseRC(ds);
  releaseRC(description);
}
