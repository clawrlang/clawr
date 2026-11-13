#ifndef CLAWR_TRUTHVALUE_BOX_H
#define CLAWR_TRUTHVALUE_BOX_H

#include "clawr_string.h"
#include "interfaces.h"
#include "truthvalue.h"

typedef struct {
  truthvalue_t value;
} TruthvalueBoxˇproperties;

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
extern const __type_info TruthvalueBoxˇtype;

static TruthvalueBox *boxTruthvalue(truthvalue_t value) {
  return allocInitRC(TruthvalueBox, 0, __rc_ISOLATED, value = value);
}

#endif // CLAWR_TRUTHVALUE_BOX_H
