#ifndef CLAWR_FIELDS_H
#define CLAWR_FIELDS_H

#include "clawr_string.h"
#include "integer.h"
#include "lanes.h"
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef enum {
  FIELD_BINARY,
  FIELD_TERNARY,
} FieldKind;

/// @brief Reference-counted field with lanes in displayed sequence order.
/// Binary lanes contain c_false or c_true; ternary lanes also allow
/// c_ambiguous. Storage uses packed 64-lane words from lanes.h, with one bit
/// plane for binary fields and two for ternary fields. APIs borrow non-NULL
/// inputs and never mutate them. Constructors and transformations return owned
/// results to release with releaseRC. Allocation failures panic; callers must
/// preserve valid kind and lane values.
typedef struct Field {
  __rc_header header;
  FieldKind kind;
  size_t length;
  /// @brief Low words first; bit 0 of word 0 is the rightmost displayed lane.
  /// Each plane has ceil(length / 64) words. Ternary x0 words precede x1
  /// words; unused high bits are always zero.
  /// This internal layout does not define language indexing or a wire format.
  BinaryWord words[];
} Field;

typedef struct Fieldˇproperties {
  FieldKind kind;
  size_t length;
} Fieldˇproperties;

extern const __type_info Fieldˇtype;

/// @brief Returns an owned field parsed in sequence order; empty strings are
/// valid. Binary accepts 0/1 (false/true); ternary accepts T/0/1
/// (false/ambiguous/true). Panics on NULL, an invalid kind, an invalid symbol,
/// or excessive length.
Field *Field¸fromString(FieldKind kind, const String *value);

/// @brief Returns an owned string using the constructor's lane symbols.
/// Panics on NULL or an invalid lane; this is not a wire-format encoding.
String *Field¸toString(const Field *field);

/// @brief Returns c_true iff kind, length, and ordered lanes match; else
/// c_false. Different kinds or lengths are unequal. Panics on NULL.
truthvalue_t Field¸equal(const Field *left, const Field *right);

/// @brief Returns an owned lane-wise negation, preserving kind and length.
/// False and true exchange; ambiguous is unchanged. Panics on NULL.
Field *Field¸not(const Field *field);

/// @brief Returns owned lane-wise AND (minimum under false < ambiguous < true).
/// Panics on NULL or unequal operand kinds or lengths.
Field *Field¸and (const Field *left, const Field *right);

/// @brief Returns owned lane-wise OR (maximum under false < ambiguous < true).
/// Panics on NULL or unequal operand kinds or lengths.
Field *Field¸or (const Field *left, const Field *right);

/// @brief Returns owned binary lane-wise XOR (true where the lanes differ).
/// Panics on NULL, non-binary operands, or unequal lengths.
Field *Field¸xor (const Field *left, const Field *right);

/// @brief Returns owned ternary adjustment of left towards each right lane.
/// False/true controls move one step towards that extreme without wrapping;
/// ambiguous controls leave the lane unchanged.
/// Panics on NULL, non-ternary operands, or unequal lengths.
Field *Field¸adjust(const Field *left, const Field *right);

/// @brief Returns owned ternary state rotation, not lane-position rotation.
/// True controls cycle false->ambiguous->true->false; false controls reverse
/// the cycle; ambiguous controls leave the lane unchanged.
/// Panics on NULL, non-ternary operands, or unequal lengths.
Field *Field¸rotateStates(const Field *left, const Field *right);

/// @brief Returns owned ternary modulation by each right lane.
/// False controls negate, true controls preserve, and ambiguous controls
/// produce ambiguous. Panics on NULL, non-ternary operands, or unequal lengths.
Field *Field¸modulate(const Field *left, const Field *right);

/// @brief Returns an owned shift preserving kind and length, filling with
/// false. If left is true, lanes move towards lower indices; otherwise towards
/// higher. Counts >= length fill the entire field; empty fields remain empty.
/// Panics on NULL.
Field *Field¸shift(const Field *field, size_t count, bool left);

/// @brief Like Field¸shift with a signed count; negative counts panic.
Field *Field¸shiftInt64(const Field *field, int64_t count, bool left);

/// @brief Like Field¸shift with a borrowed arbitrary-precision count.
/// Panics on NULL or negative counts. Large counts fill the field with false.
Field *Field¸shiftInteger(const Field *field, Integer *count, bool left);

/// @brief Panics on NULL or a length mismatch, otherwise returns the same
/// pointer. Does not allocate, retain, or release; ownership is unchanged.
Field *Field¸ensureLength(Field *field, size_t length);

/// @brief Returns the lane count as an owned Integer. Panics on NULL.
Integer *Field¸length(const Field *field);

#endif
