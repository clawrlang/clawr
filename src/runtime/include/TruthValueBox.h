#ifndef CLAWR_TRUTHVALUE_BOX_H
#define CLAWR_TRUTHVALUE_BOX_H

#include "clawr_string.h"
#include "protocols.h"
#include "truthvalue.h"

typedef struct {
  truthvalue_t value;
} TruthvalueBoxˇfields;

typedef struct {
  __rc_header header;
  truthvalue_t value;
} TruthvalueBox;

static String *TruthvalueBoxˇstringRepresentation(TruthvalueBox *self) {
  const char *cString = truthvalue·toCString(self->value);
  return String¸fromCString(cString);
}

static const clawr¸HasStringRepresentationˇwitness
    TruthvalueBoxˇclawr¸HasStringRepresentationˇwitness = {
        .stringRepresentation =
            (String * (*)(void *)) TruthvalueBoxˇstringRepresentation,
};
__protocol_conformance_entry
    TruthvalueBoxˇclawr¸HasStringRepresentationˇconformance = {
        .protocol = &clawr¸HasStringRepresentationˇtype,
        .witness_table = &TruthvalueBoxˇclawr¸HasStringRepresentationˇwitness,
};

const __type_info TruthvalueBoxˇtype = {
    .polymorphic_type = {
        .data =
            {
                .size = sizeof(TruthvalueBox),
                .conformances =
                    (const __protocol_conformance_entry *[]){
                        &TruthvalueBoxˇclawr¸HasStringRepresentationˇconformance,
                        NULL,
                    },
            },
    }};

static TruthvalueBox *boxTruthvalue(truthvalue_t value) {
  return allocInitRC(TruthvalueBox, 0, __rc_ISOLATED, value = value);
}

#endif // CLAWR_TRUTHVALUE_BOX_H
