#ifndef CLAWR_BOX_H
#define CLAWR_BOX_H

#include "clawr_string.h"
#include "protocols.h"
#include "truthvalue.h"

typedef struct {
  truthvalue_t value;
} clawr¸TruthvalueBoxˇfields;

typedef struct {
  __rc_header header;
  truthvalue_t value;
} clawr¸TruthvalueBox;

static String *
clawr¸TruthvalueˇstringRepresentation(clawr¸TruthvalueBox *self) {
  const char *cString = truthvalue·toCString(self->value);
  return String¸fromCString(cString);
}

static const clawr¸HasStringRepresentationˇwitness
    clawr¸TruthvalueBoxˇclawr¸HasStringRepresentationˇwitness = {
        .stringRepresentation =
            (String * (*)(void *)) clawr¸TruthvalueˇstringRepresentation,
};
__protocol_conformance_entry
    clawr¸TruthvalueBoxˇclawr¸HasStringRepresentationˇconformance = {
        .protocol = &clawr¸HasStringRepresentationˇtype,
        .witness_table =
            &clawr¸TruthvalueBoxˇclawr¸HasStringRepresentationˇwitness,
};

const __type_info clawr¸TruthvalueBoxˇtype = {
    .polymorphic_type = {
        .data =
            {
                .size = sizeof(clawr¸TruthvalueBox),
                .conformances =
                    (const __protocol_conformance_entry *[]){
                        &clawr¸TruthvalueBoxˇclawr¸HasStringRepresentationˇconformance,
                        NULL,
                    },
            },
    }};

static clawr¸TruthvalueBox *boxTruthvalue(truthvalue_t value) {
  return allocInitRC(clawr¸TruthvalueBox, 0, __rc_ISOLATED, value = value);
}

#endif // CLAWR_BOX_H
