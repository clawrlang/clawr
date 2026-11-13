#include "truthvalue.h"
#include "TruthValueBox.h"
#include "hash.h"

static const __interface_conformance_entry stringConformance = {
    .interface = &clawr¸HasStringRepresentationˇtype,
    .witness_table = &TruthvalueBoxˇclawr¸HasStringRepresentationˇwitness,
};
__attribute__((visibility("default"))) const __type_info TruthvalueBoxˇtype = {
    .data_type = {
        .size = sizeof(TruthvalueBox),
        .conformances = (const __interface_conformance_entry *[]){
            &stringConformance, &TruthvalueBoxˇhash_conformance,
            &TruthvalueBoxˇequal_conformance, NULL,
        },
    },
};

__attribute__((visibility("default"))) const char *
truthvalue·toCString(truthvalue_t value) {
  switch (value) {
  case c_false:
    return "false";
  case c_true:
    return "true";
  default:
    return "ambiguous";
  }
}
