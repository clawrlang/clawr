#ifndef CLAWR_LANES_H
#define CLAWR_LANES_H

#include "clawr_string.h"
#include <stdint.h>

/// @brief A word of up to 64 binary lanes, where each bit
/// corresponds to a truth value. 1 means true, 0 means false.
typedef unsigned long long BinaryWord;

/// @brief A word of up to 64 ternary lanes, where each lane can be
/// false, ambiguous, or true. Each lane is encoded using two bits:
/// (x1, x0): (0, 0) = false, (0, 1) = ambiguous, (1, 1) = true
/// The combination (x1, x0) = (1, 0) is invalid and should not be
/// produced by any operation.
typedef struct {
    /// @brief the "low" bit of the ternary-as-binary encoding.
    /// This is 1 for true and ambiguous lanes, 0 for false lanes.
    BinaryWord x0;
    /// @brief the "high" bit of the ternary-as-binary encoding.
    /// This is 0 for false and ambiguous lanes, 1 for true lanes.
    BinaryWord x1;
} TernaryWord;

BinaryWord BinaryWord¸fromCString(const char* str, uint32_t length);
TernaryWord TernaryWord¸fromCString(const char* str, uint32_t length);

char* BinaryWord·toCString(BinaryWord value, uint32_t length);
char* TernaryWord·toCString(TernaryWord value, uint32_t length);

static inline BinaryWord bitwiseAnd(BinaryWord a, BinaryWord b) {
    return a & b;
}

/// @brief Returns the bitwise OR of two binary words.
static inline BinaryWord bitwiseOr(BinaryWord a, BinaryWord b) {
    return a | b;
}

/// @brief Returns the bitwise XOR of two binary words.
static inline BinaryWord bitwiseXor(BinaryWord a, BinaryWord b) {
    return a ^ b;
}

/// @brief Returns the bitwise NOT of a binary word.
static inline BinaryWord bitwiseNot(BinaryWord a, uint32_t length) {
    BinaryWord mask = (length == 64) ? ~0ULL : ((1ULL << length) - 1);
    return ~a & mask;
}

/// @brief Returns the lanewise AND (minimum) of two ternary words.
static inline TernaryWord tritwiseAnd(TernaryWord a, TernaryWord b) {
    return (TernaryWord) {
        // not false = a is not false, and b is not false
        .x0 = a.x0 & b.x0,
        // true = a is true, and b is true
        .x1 = a.x1 & b.x1
    };
}

/// @brief Returns the lanewise OR (maximum) of two ternary words.
static inline TernaryWord tritwiseOr(TernaryWord a, TernaryWord b) {
    return (TernaryWord) {
        // not false = a is not false, or b is not false
        .x0 = a.x0 | b.x0,
        // true = a is true, or b is true
        .x1 = a.x1 | b.x1
    };

    // Explanation, x0 (not false) bit:
    // A lane is not false if it is either ambiguous or true. So we want the
    // not false bit to be 1 if either a or b has that lane as not false.
}

/// @brief Returns the lanewise NOT (negation) of a ternary word, flipping
/// false to true, true to false, and leaving ambiguous lanes unchanged.
static inline TernaryWord tritwiseNot(TernaryWord a, uint32_t length) {
    // The mask is a bunch of ones for the valid lane bits. Zeroes for the
    // invalid lanes (beyond the specified length).
    BinaryWord mask = (length == 64) ? ~0ULL : ((1ULL << length) - 1);
    return (TernaryWord) {
        // not false = a is not true and mask is on
        .x0 = ~a.x1 & mask,
        // true = a is false and mask is on
        .x1 = ~a.x0 & mask
    };

    // Explanation, x0 (not false) bit:
    // When a is false (x0 = 0), we want to return true, so x0 becomes 1.
    // When a is ambiguous (x0 = 1), we want to return ambiguous, so x0 remains 1.
    // When a is true (x0 = 1), we want to return false, so x0 becomes 0.

    // Explanation, x1 (true) bit:
    // When a is false (x1 = 0), we want to return true, so x1 becomes 1.
    // When a is ambiguous (x1 = 0), we want to return ambiguous, so x1 remains 0.
    // When a is true (x1 = 1), we want to return false, so x1 becomes 0.
}

/// @brief Adjusts a ternary word a towards another ternary word b.
/// For each lane, b is true or false, move a one step towards b.
///If b is ambiguous, leave a unchanged.
TernaryWord tritwiseAdjust__towards(TernaryWord a, TernaryWord b);
/// @brief Rotates a ternary word a by another ternary word b.
/// For each lane, if b is true, rotate a in the positive direction:
/// (false->ambiguous->true->false);
///if b is false, rotate a in the negative direction:
/// (true->ambiguous->false->true);
/// if b is ambiguous, leave a unchanged.
TernaryWord tritwiseRotate__by(TernaryWord a, TernaryWord b);
/// @brief Modulates a ternary word a by another ternary word b.
/// For each lane, if b is false, set the result to not a; if b is true,
// leave the result as a; if b is ambiguous, set the result to ambiguous.
TernaryWord tritwiseModulate__by(TernaryWord a, TernaryWord b);

/// @brief Returns a ternary word where each lane is taken from a if the
/// corresponding mask bit is 1, and set to ambiguous (01) if the mask bit is 0
static inline TernaryWord tritwiseFilter__mask(TernaryWord a, BinaryWord mask) {
    // Where mask is 1: keep a; where mask is 0: set ambiguous (01)
    return (TernaryWord) {
        // not false = (a is not false, and mask is on) or mask is off
        .x0 = (a.x0 & mask) | (~mask),
        // true = a is true and mask is on.
        .x1 = a.x1 & mask
    };

    // Explanation, x0 (not false) bit:
    // If the mask bit is 1 (on), we want to keep a's value, so x0 is a.x0.
    // If the mask bit is 0 (off), we want to set the lane to ambiguous,
    // so x0 is 1 regardless of a.

    // Explanation, x1 (true) bit:
    // If the mask bit is 1 (on), we want to keep a's value, so x1 is a.x1.
    // If the mask bit is 0 (off), we want to set the lane to ambiguous,
    // so x1 is 0 regardless of a.
}

#endif // CLAWR_LANES_H
