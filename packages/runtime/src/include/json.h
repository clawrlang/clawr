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

static String *serializeJSON(void *value) {
  if (!value)
    panic("serializeJSON does not accept NULL");
  const clawr¸JSONSerializableˇwitness *witness =
      CONFORMANCE_ENTRY(value, clawr¸JSONSerializable);
  if (!witness || !witness->toJSON)
    panic("Value does not conform to JSONSerializable");
  return witness->toJSON(value);
}

#endif // CLAWR_JSON_H
