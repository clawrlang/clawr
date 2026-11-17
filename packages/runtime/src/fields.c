#include "fields.h"
#include "panic.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

__attribute__((visibility("default"))) const __type_info Fieldˇtype = {
    .data_type = {.size = sizeof(Field)},
};

enum { LANES_PER_WORD = 64 };

static size_t wordCount(size_t length) {
  return length / LANES_PER_WORD + (length % LANES_PER_WORD != 0);
}

static size_t planeCount(FieldKind kind) {
  return kind == FIELD_TERNARY ? 2 : 1;
}

static void maskPadding(Field *field) {
  size_t remainder = field->length % LANES_PER_WORD;
  if (!remainder)
    return;
  size_t count = wordCount(field->length);
  BinaryWord mask = bitwiseNot(0, (uint32_t)remainder);
  for (size_t plane = 0; plane < planeCount(field->kind); plane++)
    field->words[plane * count + count - 1] &= mask;
}

static Field *newField(FieldKind kind, size_t length) {
  size_t count = wordCount(length);
  size_t bytesPerWord = planeCount(kind) * sizeof(BinaryWord);
  if (count > (SIZE_MAX - sizeof(Field)) / bytesPerWord)
    panic("Field is too large");
  size_t bytes = count * bytesPerWord;
  Field *field =
      allocInitRC(Field, bytes, __rc_ISOLATED, .kind = kind, .length = length);
  memset(field->words, 0, bytes);
  return field;
}

__attribute__((visibility("default")))
Field *Field¸fromString(FieldKind kind, const String *value) {
  if (!value || (kind != FIELD_BINARY && kind != FIELD_TERNARY))
    panic("Invalid field constructor arguments");
  // Preserve field diagnostics in sequence order before parsing word chunks.
  for (size_t i = 0; i < value->length; i++) {
    if (value->data[i] == 'T' && kind == FIELD_BINARY)
      panic("Invalid binary field lane");
    if (value->data[i] != '0' && value->data[i] != '1' && value->data[i] != 'T')
      panic("Invalid field lane");
  }
  Field *field = newField(kind, value->length);
  size_t count = wordCount(field->length);
  size_t end = value->length;
  for (size_t i = 0; i < count; i++) {
    uint32_t width = end < LANES_PER_WORD ? (uint32_t)end : LANES_PER_WORD;
    end -= width;
    if (kind == FIELD_BINARY) {
      field->words[i] = BinaryWord¸fromCString(value->data + end, width);
    } else {
      TernaryWord word = TernaryWord¸fromCString(value->data + end, width);
      field->words[i] = word.x0;
      field->words[count + i] = word.x1;
    }
  }
  return field;
}

__attribute__((visibility("default")))
String *Field¸toString(const Field *field) {
  if (!field)
    panic("Field.toString requires a field");
  if (field->length == SIZE_MAX)
    panic("Field is too large to format");
  char *data = malloc(field->length + 1);
  if (!data)
    panic("Out of memory in Field.toString");
  size_t count = wordCount(field->length);
  size_t end = field->length;
  for (size_t i = 0; i < count; i++) {
    uint32_t width = end < LANES_PER_WORD ? (uint32_t)end : LANES_PER_WORD;
    end -= width;
    char *chunk = field->kind == FIELD_BINARY
                      ? BinaryWord·toCString(field->words[i], width)
                      : TernaryWord·toCString(
                            (TernaryWord){.x0 = field->words[i],
                                          .x1 = field->words[count + i]},
                            width);
    memcpy(data + end, chunk, width);
    free(chunk);
  }
  String *result = String¸fromBytes(data, field->length);
  free(data);
  return result;
}

__attribute__((visibility("default")))
truthvalue_t Field¸equal(const Field *left, const Field *right) {
  if (!left || !right)
    panic("Field equality requires fields");
  return left->kind == right->kind && left->length == right->length &&
                 memcmp(left->words, right->words,
                        wordCount(left->length) * planeCount(left->kind) *
                            sizeof(BinaryWord)) == 0
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
  size_t count = wordCount(left->length);
  for (size_t i = 0; i < count; i++) {
    if (left->kind == FIELD_BINARY) {
      BinaryWord a = left->words[i], b = right->words[i];
      switch (op) {
      case OP_AND:
        result->words[i] = bitwiseAnd(a, b);
        break;
      case OP_OR:
        result->words[i] = bitwiseOr(a, b);
        break;
      case OP_XOR:
        result->words[i] = bitwiseXor(a, b);
        break;
      default:
        panic("Ternary operation requires ternary fields");
      }
      continue;
    }
    TernaryWord a = {.x0 = left->words[i], .x1 = left->words[count + i]};
    TernaryWord b = {.x0 = right->words[i], .x1 = right->words[count + i]};
    TernaryWord value;
    switch (op) {
    case OP_AND:
      value = tritwiseAnd(a, b);
      break;
    case OP_OR:
      value = tritwiseOr(a, b);
      break;
    case OP_ADJUST:
      value = tritwiseAdjust__towards(a, b);
      break;
    case OP_ROTATE:
      value = tritwiseRotate__by(a, b);
      break;
    case OP_MODULATE:
      value = tritwiseModulate__by(a, b);
      break;
    default:
      panic("XOR requires binary fields");
    }
    result->words[i] = value.x0;
    result->words[count + i] = value.x1;
  }
  maskPadding(result);
  return result;
}

__attribute__((visibility("default")))
Field *Field¸not(const Field *field) {
  if (!field)
    panic("Field NOT requires a field");
  Field *result = newField(field->kind, field->length);
  size_t count = wordCount(field->length);
  for (size_t i = 0; i < count; i++) {
    if (field->kind == FIELD_BINARY) {
      result->words[i] = bitwiseNot(field->words[i], LANES_PER_WORD);
    } else {
      TernaryWord word = {.x0 = field->words[i], .x1 = field->words[count + i]};
      TernaryWord value = tritwiseNot(word, LANES_PER_WORD);
      result->words[i] = value.x0;
      result->words[count + i] = value.x1;
    }
  }
  maskPadding(result);
  return result;
}

__attribute__((visibility("default")))
Field *Field¸and(const Field *left, const Field *right) {
  return binaryOperation(left, right, OP_AND);
}

__attribute__((visibility("default")))
Field *Field¸or(const Field *left, const Field *right) {
  return binaryOperation(left, right, OP_OR);
}

__attribute__((visibility("default")))
Field *Field¸xor(const Field *left, const Field *right) {
  return binaryOperation(left, right, OP_XOR);
}

__attribute__((visibility("default")))
Field *Field¸adjust(const Field *left, const Field *right) {
  return binaryOperation(left, right, OP_ADJUST);
}

__attribute__((visibility("default")))
Field *Field¸rotateStates(const Field *left, const Field *right) {
  return binaryOperation(left, right, OP_ROTATE);
}

__attribute__((visibility("default")))
Field *Field¸modulate(const Field *left, const Field *right) {
  return binaryOperation(left, right, OP_MODULATE);
}

__attribute__((visibility("default")))
Field *Field¸shift(const Field *field, size_t count, bool left) {
  if (!field)
    panic("Field shift requires a field");
  Field *result = newField(field->kind, field->length);
  if (count >= field->length)
    return result;
  size_t words = wordCount(field->length);
  size_t offset = count / LANES_PER_WORD;
  unsigned shift = count % LANES_PER_WORD;
  for (size_t plane = 0; plane < planeCount(field->kind); plane++) {
    const BinaryWord *source = field->words + plane * words;
    BinaryWord *target = result->words + plane * words;
    for (size_t i = 0; i < words - offset; i++) {
      if (left) {
        target[i + offset] = source[i] << shift;
        if (shift && i > 0)
          target[i + offset] |= source[i - 1] >> (LANES_PER_WORD - shift);
      } else {
        target[i] = source[i + offset] >> shift;
        if (shift && i + offset + 1 < words)
          target[i] |= source[i + offset + 1] << (LANES_PER_WORD - shift);
      }
    }
  }
  maskPadding(result);
  return result;
}

__attribute__((visibility("default")))
Field *Field¸shiftInt64(const Field *field, int64_t count, bool left) {
  if (count < 0)
    panic("Field shift count cannot be negative");
  if ((uintmax_t)count > SIZE_MAX)
    return Field¸shift(field, SIZE_MAX, left);
  return Field¸shift(field, (size_t)count, left);
}

__attribute__((visibility("default")))
Field *Field¸shiftInteger(const Field *field, Integer *count, bool left) {
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

__attribute__((visibility("default")))
Field *Field¸ensureLength(Field *field, size_t length) {
  if (!field || field->length != length)
    panic("Field has an incompatible length");
  return field;
}

__attribute__((visibility("default")))
Integer *Field¸length(const Field *field) {
  if (!field)
    panic("Field length requires a field");
  char text[3 * sizeof(size_t) + 1];
  snprintf(text, sizeof(text), "%zu", field->length);
  return Integer¸fromCString(text);
}
