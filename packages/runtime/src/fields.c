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
Field *Field¸fromOctets(const uint8_t *data, size_t length) {
  if (!data)
    panic("Octet decoding requires a buffer");
  if (length > SIZE_MAX / 8)
    panic("Field is too large");
  Field *field = newField(FIELD_BINARY, length * 8);
  for (size_t i = 0; i < length; i++) {
    size_t position = (length - 1 - i) * 8;
    field->words[position / LANES_PER_WORD] |=
        (BinaryWord)data[i] << (position % LANES_PER_WORD);
  }
  return field;
}

__attribute__((visibility("default")))
uint8_t *Field¸toOctets(const Field *field) {
  if (!field || field->kind != FIELD_BINARY)
    panic("Octet encoding requires a binary field");
  if (field->length % 8)
    panic("Octet encoding requires a multiple of 8 lanes");
  size_t length = field->length / 8;
  uint8_t *data = malloc(length ? length : 1);
  if (!data)
    panic("Out of memory encoding octets");
  for (size_t i = 0; i < length; i++) {
    size_t position = (length - 1 - i) * 8;
    data[i] = (uint8_t)(field->words[position / LANES_PER_WORD] >>
                        (position % LANES_PER_WORD));
  }
  return data;
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

// Offsets here count from the rightmost lane. Target ranges must be zeroed.
static void copyLanes(Field *target, size_t targetOffset, const Field *source,
                      size_t sourceOffset, size_t length) {
  size_t sourceWords = wordCount(source->length);
  size_t targetWords = wordCount(target->length);
  for (size_t plane = 0; plane < planeCount(source->kind); plane++) {
    size_t copied = 0;
    while (copied < length) {
      size_t from = sourceOffset + copied, to = targetOffset + copied;
      unsigned shift = from % LANES_PER_WORD;
      unsigned targetShift = to % LANES_PER_WORD;
      size_t width = LANES_PER_WORD - targetShift;
      if (width > length - copied)
        width = length - copied;
      size_t word = from / LANES_PER_WORD;
      const BinaryWord *data = source->words + plane * sourceWords;
      BinaryWord value = data[word] >> shift;
      if (shift && word + 1 < sourceWords)
        value |= data[word + 1] << (LANES_PER_WORD - shift);
      target->words[plane * targetWords + to / LANES_PER_WORD] |=
          (value & bitwiseNot(0, (uint32_t)width)) << targetShift;
      copied += width;
    }
  }
}

__attribute__((visibility("default")))
truthvalue_t Field¸lane(const Field *field, size_t index) {
  if (!field || index >= field->length)
    panic("Field lane index is out of bounds");
  size_t position = field->length - 1 - index;
  size_t word = position / LANES_PER_WORD;
  BinaryWord bit = 1ULL << (position % LANES_PER_WORD);
  if (field->kind == FIELD_BINARY)
    return field->words[word] & bit ? c_true : c_false;
  bool x0 = (field->words[word] & bit) != 0;
  bool x1 = (field->words[wordCount(field->length) + word] & bit) != 0;
  if (x1 && !x0)
    panic("Invalid field lane");
  return x1 ? c_true : x0 ? c_ambiguous : c_false;
}

__attribute__((visibility("default")))
Field *Field¸slice(const Field *field, size_t start, size_t length) {
  if (!field || start > field->length || length > field->length - start)
    panic("Field slice is out of bounds");
  Field *result = newField(field->kind, length);
  copyLanes(result, 0, field, field->length - start - length, length);
  return result;
}

__attribute__((visibility("default")))
Field *Field¸concat(const Field *left, const Field *right) {
  if (!left || !right || left->kind != right->kind)
    panic("Field concatenation requires fields of the same kind");
  if (right->length > SIZE_MAX - left->length)
    panic("Field is too large");
  Field *result = newField(left->kind, left->length + right->length);
  copyLanes(result, right->length, left, 0, left->length);
  copyLanes(result, 0, right, 0, right->length);
  return result;
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

static size_t integerSize(Integer *count, const char *negativeError,
                          bool saturate) {
  __int128 value = 0;
  for (size_t i = count->digits->count; i > 0; i--) {
    value = value * (__int128)BASE +
            ARRAY_ELEMENT_AT(i - 1, count->digits, digit_t);
    if (value < 0)
      panic(negativeError);
    // Bound prefixes so the next radix multiplication fits in int128.
    __int128 limit = i == 1 ? (__int128)SIZE_MAX : INT64_MAX;
    if (value > limit) {
      if (!saturate)
        panic("Field index or count is too large");
      return SIZE_MAX;
    }
  }
  return (size_t)value;
}

__attribute__((visibility("default")))
Field *Field¸shiftInteger(const Field *field, Integer *count, bool left) {
  if (!field || !count)
    panic("Field shift requires a field and a count");
  return Field¸shift(
      field, integerSize(count, "Field shift count cannot be negative", true),
      left);
}

__attribute__((visibility("default")))
size_t Field¸sizeInt64(int64_t value) {
  if (value < 0)
    panic("Field index or count cannot be negative");
  if ((uintmax_t)value > SIZE_MAX)
    panic("Field index or count is too large");
  return (size_t)value;
}

__attribute__((visibility("default")))
size_t Field¸sizeInteger(Integer *value) {
  if (!value)
    panic("Field index or count requires an integer");
  return integerSize(value, "Field index or count cannot be negative", false);
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
