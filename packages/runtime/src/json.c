#include "json.h"

#include "integer.h"
#include "panic.h"
#include "real.h"

#include <inttypes.h>
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void reserve(JSONWriter *writer, size_t additional) {
  if (additional > SIZE_MAX - writer->length - 1)
    panic("JSON output is too large");

  size_t required = writer->length + additional + 1;
  if (required <= writer->capacity)
    return;

  size_t capacity = writer->capacity ? writer->capacity : 64;
  while (capacity < required) {
    if (capacity > SIZE_MAX / 2) {
      capacity = required;
      break;
    }
    capacity *= 2;
  }

  char *data = realloc(writer->data, capacity);
  if (!data)
    panic("Out of memory while encoding JSON");
  writer->data = data;
  writer->capacity = capacity;
}

static void appendBytes(JSONWriter *writer, const char *text, size_t length) {
  reserve(writer, length);
  memcpy(writer->data + writer->length, text, length);
  writer->length += length;
  writer->data[writer->length] = '\0';
}

static void appendQuotedBytes(JSONWriter *writer, const char *text,
                              size_t length) {
  static const char hex[] = "0123456789abcdef";
  JSONWriter¸appendRaw(writer, "\"");
  for (size_t i = 0; i < length; i++) {
    unsigned char c = (unsigned char)text[i];
    switch (c) {
    case '"':
      JSONWriter¸appendRaw(writer, "\\\"");
      break;
    case '\\':
      JSONWriter¸appendRaw(writer, "\\\\");
      break;
    case '\b':
      JSONWriter¸appendRaw(writer, "\\b");
      break;
    case '\f':
      JSONWriter¸appendRaw(writer, "\\f");
      break;
    case '\n':
      JSONWriter¸appendRaw(writer, "\\n");
      break;
    case '\r':
      JSONWriter¸appendRaw(writer, "\\r");
      break;
    case '\t':
      JSONWriter¸appendRaw(writer, "\\t");
      break;
    default:
      if (c < 0x20) {
        char escaped[] = {'\\', 'u', '0', '0', hex[c >> 4], hex[c & 0x0f]};
        appendBytes(writer, escaped, sizeof escaped);
      } else {
        appendBytes(writer, (const char *)&text[i], 1);
      }
    }
  }
  JSONWriter¸appendRaw(writer, "\"");
}

__attribute__((visibility("default"))) void JSONWriter¸init(
    JSONWriter *writer) {
  if (!writer)
    panic("JSONWriter¸init does not accept NULL");
  *writer = (JSONWriter){0};
}

__attribute__((visibility("default"))) void JSONWriter¸appendRaw(
    JSONWriter *writer, const char *text) {
  if (!writer || !text)
    panic("JSONWriter¸appendRaw does not accept NULL");
  appendBytes(writer, text, strlen(text));
}

__attribute__((visibility("default"))) void JSONWriter¸appendQuotedCString(
    JSONWriter *writer, const char *text) {
  if (!writer || !text)
    panic("JSONWriter¸appendQuotedCString does not accept NULL");
  appendQuotedBytes(writer, text, strlen(text));
}

__attribute__((visibility("default"))) void JSONWriter¸appendString(
    JSONWriter *writer, String *text) {
  if (!writer || !text)
    panic("JSONWriter¸appendString does not accept NULL");
  appendQuotedBytes(writer, text->data, text->length);
}

__attribute__((visibility("default"))) void JSONWriter¸appendTruthvalue(
    JSONWriter *writer, truthvalue_t value) {
  switch (value) {
  case c_false:
    JSONWriter¸appendRaw(writer, "false");
    break;
  case c_ambiguous:
    JSONWriter¸appendRaw(writer, "null");
    break;
  case c_true:
    JSONWriter¸appendRaw(writer, "true");
    break;
  default:
    panic("Invalid truthvalue while encoding JSON");
  }
}

__attribute__((visibility("default"))) void JSONWriter¸appendInt64(
    JSONWriter *writer, int64_t value) {
  char number[sizeof(int64_t) * 3 + 2];
  int length = snprintf(number, sizeof number, "%" PRId64, value);
  if (length < 0 || (size_t)length >= sizeof number)
    panic("Failed to format integer as JSON");
  appendBytes(writer, number, (size_t)length);
}

__attribute__((visibility("default"))) void JSONWriter¸appendInteger(
    JSONWriter *writer, Integer *value) {
  if (!writer || !value)
    panic("JSONWriter¸appendInteger does not accept NULL");
  String *number = Integer·toStringRC(value);
  JSONWriter¸appendRaw(writer, String·toCString(number));
  releaseRC(number);
}

__attribute__((visibility("default"))) void JSONWriter¸appendReal(
    JSONWriter *writer, Real *value) {
  if (!writer || !value)
    panic("JSONWriter¸appendReal does not accept NULL");
  String *number = Real·toStringRC(value);
  JSONWriter¸appendRaw(writer, String·toCString(number));
  releaseRC(number);
}

__attribute__((visibility("default"))) void JSONWriter¸appendDouble(
    JSONWriter *writer, double value) {
  if (!writer || !isfinite(value))
    panic("Cannot encode a non-finite real as JSON");
  char number[32];
  int length = snprintf(number, sizeof number, "%.17g", value);
  if (length < 0 || (size_t)length >= sizeof number)
    panic("Failed to format real as JSON");
  appendBytes(writer, number, (size_t)length);
}

__attribute__((visibility("default"))) String *JSONWriter¸finish(
    JSONWriter *writer) {
  if (!writer)
    panic("JSONWriter¸finish does not accept NULL");
  reserve(writer, 0);
  writer->data[writer->length] = '\0';
  String *result = allocInitRC(String, 0, __rc_ISOLATED,
                              .data = writer->data, .length = writer->length);
  *writer = (JSONWriter){0};
  return result;
}

typedef struct JSONFrame {
  struct JSONFrame *parent;
  Integer *remaining;
  bool pending;
  bool valueWritten;
  bool hasFields;
} JSONFrame;

struct clawr¸JSONBuffer {
  __rc_header header;
  JSONWriter writer;
  JSONFrame *frame;
  bool rootWritten;
  bool finalized;
};
typedef struct {
  JSONWriter writer;
  JSONFrame *frame;
  bool rootWritten;
  bool finalized;
} clawr¸JSONBufferˇproperties;

static void releaseJSONBuffer(void *self) {
  clawr¸JSONBuffer *buffer = self;
  free(buffer->writer.data);
  while (buffer->frame) {
    JSONFrame *frame = buffer->frame;
    buffer->frame = frame->parent;
    releaseRC(frame->remaining);
    free(frame);
  }
}

__attribute__((visibility("default")))
const __type_info clawr¸JSONBufferˇtype = {
    .data_type = {
        .size = sizeof(clawr¸JSONBuffer),
        .release_nested_properties = releaseJSONBuffer,
    },
};

__attribute__((visibility("default")))
clawr¸JSONBuffer *clawr¸newJSONBuffer(void) {
  return allocInitRC(clawr¸JSONBuffer, 0, __rc_SHARED, 0);
}

static void requireWritable(clawr¸JSONBuffer *buffer) {
  if (!buffer)
    panic("JSON writer does not accept NULL");
  if (buffer->finalized)
    panic("JSON writer is already finalized");
}

static void consumeValue(clawr¸JSONBuffer *buffer) {
  requireWritable(buffer);
  if (buffer->frame) {
    if (!buffer->frame->pending || buffer->frame->valueWritten)
      panic("JSON field requires exactly one value");
    buffer->frame->valueWritten = true;
  } else {
    if (buffer->rootWritten)
      panic("JSON document requires exactly one root");
    buffer->rootWritten = true;
  }
}

#define JSON_SCALAR(Name, Type, append)                                       \
  __attribute__((visibility("default")))                                     \
  void clawr¸jsonWrite##Name##˛value(clawr¸JSONBuffer *buffer, Type value) {  \
    consumeValue(buffer);                                                    \
    JSONWriter¸append##append(&buffer->writer, value);                       \
  }

JSON_SCALAR(String, String *, String)
JSON_SCALAR(Integer, Integer *, Integer)
JSON_SCALAR(Real, Real *, Real)
JSON_SCALAR(Truthvalue, truthvalue_t, Truthvalue)

__attribute__((visibility("default")))
void clawr¸jsonBeginStructure˛fieldCount(clawr¸JSONBuffer *buffer,
                                        Integer *fieldCount) {
  requireWritable(buffer);
  if (!fieldCount || Integer¸compare(fieldCount, &Integer¸zero) < 0)
    panic("JSON structure field count must be nonnegative");
  consumeValue(buffer);
  JSONFrame *frame = calloc(1, sizeof(*frame));
  if (!frame)
    panic("Out of memory while encoding JSON");
  frame->parent = buffer->frame;
  frame->remaining = retainRC(fieldCount);
  buffer->frame = frame;
  JSONWriter¸appendRaw(&buffer->writer, "{");
}

__attribute__((visibility("default")))
void clawr¸jsonBeginField˛name(clawr¸JSONBuffer *buffer, String *name) {
  requireWritable(buffer);
  JSONFrame *frame = buffer->frame;
  if (!frame || frame->pending ||
      Integer¸compare(frame->remaining, &Integer¸zero) == 0)
    panic("Unexpected JSON field");
  if (frame->hasFields)
    JSONWriter¸appendRaw(&buffer->writer, ",");
  JSONWriter¸appendString(&buffer->writer, name);
  JSONWriter¸appendRaw(&buffer->writer, ":");
  frame->pending = true;
  frame->valueWritten = false;
}

__attribute__((visibility("default")))
void clawr¸jsonEndField(clawr¸JSONBuffer *buffer) {
  requireWritable(buffer);
  JSONFrame *frame = buffer->frame;
  if (!frame || !frame->pending || !frame->valueWritten)
    panic("JSON field requires exactly one complete value");
  Integer *one = Integer¸fromInt64(1);
  Integer *remaining = Integer¸subtract(frame->remaining, one);
  releaseRC(one);
  releaseRC(frame->remaining);
  frame->remaining = remaining;
  frame->pending = false;
  frame->hasFields = true;
}

__attribute__((visibility("default")))
void clawr¸jsonEndStructure(clawr¸JSONBuffer *buffer) {
  requireWritable(buffer);
  JSONFrame *frame = buffer->frame;
  if (!frame || frame->pending ||
      Integer¸compare(frame->remaining, &Integer¸zero) != 0)
    panic("JSON structure fields do not match declared count");
  JSONWriter¸appendRaw(&buffer->writer, "}");
  buffer->frame = frame->parent;
  releaseRC(frame->remaining);
  free(frame);
}

__attribute__((visibility("default")))
String *clawr¸jsonResult(clawr¸JSONBuffer *buffer) {
  requireWritable(buffer);
  if (!buffer->rootWritten || buffer->frame)
    panic("JSON document requires one complete root");
  buffer->finalized = true;
  return JSONWriter¸finish(&buffer->writer);
}
