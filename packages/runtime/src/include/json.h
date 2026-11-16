#ifndef CLAWR_JSON_H
#define CLAWR_JSON_H

#include "clawr_string.h"
#include "interfaces.h"
#include "panic.h"
#include "refc.h"
#include "truthvalue.h"
#include <stddef.h>
#include <stdint.h>

typedef struct Integer Integer;
typedef struct Real Real;

typedef struct JSONWriter {
  char *data;
  size_t length;
  size_t capacity;
} JSONWriter;

void JSONWriter¸init(JSONWriter *writer);
void JSONWriter¸appendRaw(JSONWriter *writer, const char *text);
void JSONWriter¸appendQuotedCString(JSONWriter *writer, const char *text);
void JSONWriter¸appendString(JSONWriter *writer, String *text);
void JSONWriter¸appendTruthvalue(JSONWriter *writer, truthvalue_t value);
void JSONWriter¸appendInt64(JSONWriter *writer, int64_t value);
void JSONWriter¸appendInteger(JSONWriter *writer, Integer *value);
void JSONWriter¸appendReal(JSONWriter *writer, Real *value);
void JSONWriter¸appendDouble(JSONWriter *writer, double value);
String *JSONWriter¸finish(JSONWriter *writer);

typedef struct clawr¸JSONBuffer clawr¸JSONBuffer;
extern const __type_info clawr¸JSONBufferˇtype;

clawr¸JSONBuffer *clawr¸newJSONBuffer(void);
void clawr¸jsonWriteString˛value(clawr¸JSONBuffer *buffer, String *value);
void clawr¸jsonWriteInteger˛value(clawr¸JSONBuffer *buffer, Integer *value);
void clawr¸jsonWriteReal˛value(clawr¸JSONBuffer *buffer, Real *value);
void clawr¸jsonWriteTruthvalue˛value(clawr¸JSONBuffer *buffer, truthvalue_t value);
void clawr¸jsonBeginStructure˛fieldCount(clawr¸JSONBuffer *buffer,
                                        Integer *fieldCount);
void clawr¸jsonBeginField˛name(clawr¸JSONBuffer *buffer, String *name);
void clawr¸jsonEndField(clawr¸JSONBuffer *buffer);
void clawr¸jsonEndStructure(clawr¸JSONBuffer *buffer);
String *clawr¸jsonResult(clawr¸JSONBuffer *buffer);

#endif // CLAWR_JSON_H
