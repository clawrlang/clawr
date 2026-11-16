#ifndef CLAWR_FIELDS_H
#define CLAWR_FIELDS_H

#include "clawr_string.h"
#include "integer.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef enum {
  FIELD_BINARY,
  FIELD_TERNARY,
} FieldKind;

typedef struct Field {
  __rc_header header;
  FieldKind kind;
  size_t length;
  int8_t lanes[];
} Field;

typedef struct Fieldˇproperties {
  FieldKind kind;
  size_t length;
} Fieldˇproperties;

extern const __type_info Fieldˇtype;

Field *Field¸fromString(FieldKind kind, const String *value);
String *Field¸toString(const Field *field);
truthvalue_t Field¸equal(const Field *left, const Field *right);
Field *Field¸not(const Field *field);
Field *Field¸and(const Field *left, const Field *right);
Field *Field¸or(const Field *left, const Field *right);
Field *Field¸xor(const Field *left, const Field *right);
Field *Field¸adjust(const Field *left, const Field *right);
Field *Field¸rotateStates(const Field *left, const Field *right);
Field *Field¸modulate(const Field *left, const Field *right);
Field *Field¸shift(const Field *field, size_t count, bool left);
Field *Field¸shiftInt64(const Field *field, int64_t count, bool left);
Field *Field¸shiftInteger(const Field *field, Integer *count, bool left);
Field *Field¸ensureLength(Field *field, size_t length);
Integer *Field¸length(const Field *field);

#endif
