#include "fields.h"
#include "panic.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

__attribute__((visibility("default"))) const __type_info Fieldˇtype = {
    .data_type = {.size = sizeof(Field)},
};

static Field *newField(FieldKind kind, size_t length) {
  if (length > SIZE_MAX - sizeof(Field))
    panic("Field is too large");
  return allocInitRC(Field, length, __rc_ISOLATED, .kind = kind,
                     .length = length);
}

__attribute__((visibility("default"))) Field *
Field¸fromString(FieldKind kind, const String *value) {
  if (!value || (kind != FIELD_BINARY && kind != FIELD_TERNARY))
    panic("Invalid field constructor arguments");
  Field *field = newField(kind, value->length);
  for (size_t i = 0; i < value->length; i++) {
    switch (value->data[i]) {
    case '0':
      field->lanes[i] = kind == FIELD_BINARY ? c_false : c_ambiguous;
      break;
    case '1':
      field->lanes[i] = c_true;
      break;
    case 'T':
      if (kind == FIELD_BINARY)
        panic("Invalid binary field lane");
      field->lanes[i] = c_false;
      break;
    default:
      panic("Invalid field lane");
    }
  }
  return field;
}

__attribute__((visibility("default"))) String *
Field¸toString(const Field *field) {
  if (!field)
    panic("Field.toString requires a field");
  char *data = malloc(field->length + 1);
  if (!data)
    panic("Out of memory in Field.toString");
  for (size_t i = 0; i < field->length; i++) {
    if (field->lanes[i] == c_true)
      data[i] = '1';
    else if (field->lanes[i] == c_false)
      data[i] = field->kind == FIELD_BINARY ? '0' : 'T';
    else if (field->lanes[i] == c_ambiguous && field->kind == FIELD_TERNARY)
      data[i] = '0';
    else
      panic("Invalid field lane");
  }
  String *result = String¸fromBytes(data, field->length);
  free(data);
  return result;
}

__attribute__((visibility("default"))) truthvalue_t
Field¸equal(const Field *left, const Field *right) {
  if (!left || !right)
    panic("Field equality requires fields");
  return left->kind == right->kind && left->length == right->length &&
                 memcmp(left->lanes, right->lanes, left->length) == 0
             ? c_true
             : c_false;
}

typedef enum {
  OP_AND,
  OP_OR,
  OP_XOR,
  OP_ADJUST,
  OP_ROTATE,
  OP_MODULATE,
} FieldOperation;

static Field *binaryOperation(const Field *left, const Field *right,
                              FieldOperation op) {
  if (!left || !right || left->kind != right->kind ||
      left->length != right->length)
    panic("Field operands must have the same kind and length");
  if (op == OP_XOR && left->kind != FIELD_BINARY)
    panic("XOR requires binary fields");
  if (op >= OP_ADJUST && left->kind != FIELD_TERNARY)
    panic("Ternary operation requires ternary fields");
  Field *result = newField(left->kind, left->length);
  for (size_t i = 0; i < left->length; i++) {
    truthvalue_t a = left->lanes[i], b = right->lanes[i];
    switch (op) {
    case OP_AND: result->lanes[i] = truthvalue¸and(a, b); break;
    case OP_OR: result->lanes[i] = truthvalue¸or(a, b); break;
    case OP_XOR: result->lanes[i] = a != b ? c_true : c_false; break;
    case OP_ADJUST: result->lanes[i] = adjust__towards(a, b); break;
    case OP_ROTATE: result->lanes[i] = rotate__by(a, b); break;
    case OP_MODULATE: result->lanes[i] = modulate__by(a, b); break;
    }
  }
  return result;
}

__attribute__((visibility("default"))) Field *
Field¸not(const Field *field) {
  if (!field)
    panic("Field NOT requires a field");
  Field *result = newField(field->kind, field->length);
  for (size_t i = 0; i < field->length; i++)
    result->lanes[i] = -field->lanes[i];
  return result;
}

#define FIELD_BINARY_OPERATION(name, op)                                      \
  __attribute__((visibility("default"))) Field *name(                         \
      const Field *left, const Field *right) {                                 \
    return binaryOperation(left, right, op);                                   \
  }

FIELD_BINARY_OPERATION(Field¸and, OP_AND)
FIELD_BINARY_OPERATION(Field¸or, OP_OR)
FIELD_BINARY_OPERATION(Field¸xor, OP_XOR)
FIELD_BINARY_OPERATION(Field¸adjust, OP_ADJUST)
FIELD_BINARY_OPERATION(Field¸rotateStates, OP_ROTATE)
FIELD_BINARY_OPERATION(Field¸modulate, OP_MODULATE)

__attribute__((visibility("default"))) Field *
Field¸shift(const Field *field, size_t count, bool left) {
  if (!field)
    panic("Field shift requires a field");
  Field *result = newField(field->kind, field->length);
  for (size_t i = 0; i < field->length; i++) {
    if (count >= field->length)
      result->lanes[i] = c_false;
    else if (left)
      result->lanes[i] = i < field->length - count
                             ? field->lanes[i + count] : c_false;
    else
      result->lanes[i] = i >= count ? field->lanes[i - count] : c_false;
  }
  return result;
}

__attribute__((visibility("default"))) Field *
Field¸shiftInt64(const Field *field, int64_t count, bool left) {
  if (count < 0)
    panic("Field shift count cannot be negative");
  if ((uintmax_t)count > SIZE_MAX)
    return Field¸shift(field, SIZE_MAX, left);
  return Field¸shift(field, (size_t)count, left);
}

__attribute__((visibility("default"))) Field *
Field¸shiftInteger(const Field *field, Integer *count, bool left) {
  if (!field || !count)
    panic("Field shift requires a field and a count");
  String *text = Integer·toStringRC(count);
  if (text->length && text->data[0] == '-')
    panic("Field shift count cannot be negative");
  size_t value = 0;
  for (size_t i = 0; i < text->length; i++) {
    unsigned digit = (unsigned)(text->data[i] - '0');
    if (digit > 9)
      panic("Invalid integer shift count");
    if (value > (SIZE_MAX - digit) / 10) {
      value = SIZE_MAX;
      break;
    }
    value = value * 10 + digit;
  }
  releaseRC(text);
  return Field¸shift(field, value, left);
}

__attribute__((visibility("default"))) Field *
Field¸ensureLength(Field *field, size_t length) {
  if (!field || field->length != length)
    panic("Field has an incompatible length");
  return field;
}

__attribute__((visibility("default"))) Integer *
Field¸length(const Field *field) {
  if (!field)
    panic("Field length requires a field");
  char text[3 * sizeof(size_t) + 1];
  snprintf(text, sizeof(text), "%zu", field->length);
  return Integer¸fromCString(text);
}
