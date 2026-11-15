#include "json.h"

#include "integer.h"
#include "panic.h"
#include "real.h"

#include <inttypes.h>
#include <math.h>
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
  String *result = String¸fromCString(writer->data ? writer->data : "");
  free(writer->data);
  *writer = (JSONWriter){0};
  return result;
}
