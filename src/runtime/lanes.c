#include "lanes.h"
#include "panic.h"

#include <stdlib.h>

BinaryWord BinaryWord¸fromCString(const char* str, uint32_t length) {
    if (length == 0 || length > 64) {
        panic("BinaryLaneField.fromCString expects length in [1, 64]");
    }

    BinaryWord value = 0;
    for (uint32_t i = 0; i < length; i++) {
        char c = str[i];
        if (c == '0') {
            // do nothing, bit is already 0
        } else if (c == '1') {
            value |= (1ULL << (length - 1 - i));
        } else {
            panic("Invalid character in binary lane string");
        }
    }
    return value;
}

char* BinaryWord·toCString(BinaryWord value, uint32_t length) {
    if (length == 0 || length > 64) {
        panic("BinaryLaneField.toCString expects length in [1, 64]");
    }

    char* buffer = malloc((size_t) length + 1);
    if (!buffer) panic("Out of memory in BinaryLaneField.toCString");

    for (uint32_t i = 0; i < length; i++) {
        BinaryWord bit = 1ULL << (length - 1 - i);
        buffer[i] = (value & bit) ? '1' : '0';
    }
    buffer[length] = '\0';
    return buffer;
}


// false = {.x0=0, .x1=0}, ambiguous = {.x0=1, .x1=0}, true = {.x0=1, .x1=1}
TernaryWord TernaryWord¸fromCString(const char* str, uint32_t length) {
    if (length == 0 || length > 64) {
        panic("TernaryLaneField.fromCString expects length in [1, 64]");
    }

    TernaryWord value = {0, 0};
    for (uint32_t i = 0; i < length; i++) {
        char c = str[i];
        if (c == 'T') { // false
            // do nothing, bits are already 0
        } else if (c == '0') { // ambiguous
            value.x0 |= (1ULL << (length - 1 - i));
        } else if (c == '1') { // true
            value.x0 |= (1ULL << (length - 1 - i));
            value.x1 |= (1ULL << (length - 1 - i));
        } else {
            panic("Invalid character in ternary lane string");
        }
    }
    return value;
}

char* TernaryWord·toCString(TernaryWord value, uint32_t length) {
    if (length == 0 || length > 64) {
        panic("TernaryLaneField.toCString expects length in [1, 64]");
    }

    char* buffer = malloc((size_t) length + 1);
    if (!buffer) panic("Out of memory in TernaryLaneField.toCString");

    for (uint32_t i = 0; i < length; i++) {
        BinaryWord bit = 1ULL << (length - 1 - i);
        TernaryWord b = (TernaryWord) {
            .x0 = (value.x0 & bit) ? 1ULL : 0ULL,
            .x1 = (value.x1 & bit) ? 1ULL : 0ULL
        };

        if (b.x0 == 0ULL && b.x1 == 0ULL) {
            buffer[i] = 'T';
        } else if (b.x0 == 1ULL && b.x1 == 0ULL) {
            buffer[i] = '0';
        } else if (b.x0 == 1ULL && b.x1 == 1ULL) {
            buffer[i] = '1';
        } else {
            panic("Invalid non-canonical ternary lane in TernaryLaneField.toCString");
        }
    }

    buffer[length] = '\0';
    return buffer;
}


// Clamped addition: result = min(2, a+b) per lane
// Clamped addition: result = max(-1, min(1, a + b)) per lane
TernaryWord tritwiseAdjust__towards(TernaryWord a, TernaryWord b) {
    // Canonical encoding: 00 = -1, 01 = 0, 11 = +1, 10 = invalid
    // For each lane, decode, add, clamp, encode
    // Let:
    //   a0 = a.x0, a1 = a.x1, b0 = b.x0, b1 = b.x1
    //   v = (a1 << 1 | a0), w = (b1 << 1 | b0)
    //   -1: 00, 0: 01, +1: 11
    // Table for all 9 combinations:
    //   -1 + -1 = -2 -> clamp -1
    //   -1 +  0 = -1
    //   -1 + +1 = 0
    //    0 + -1 = -1
    //    0 +  0 = 0
    //    0 + +1 = +1
    //   +1 + -1 = 0
    //   +1 +  0 = +1
    //   +1 + +1 = +2 -> clamp +1
    //
    // Bitwise logic:
    // For each lane:
    //   a_val = (a1 << 1) | a0; b_val = (b1 << 1) | b0
    //   a: 00=-1, 01=0, 11=+1
    //   b: 00=-1, 01=0, 11=+1
    //
    //   result = clamp(a + b, -1, +1)
    //
    //   result == -1: (a == -1 && b != +1) || (a == 0 && b == -1)
    //   result == 0: (a == -1 && b == +1) || (a == 0 && b == 0) || (a == +1 && b == -1)
    //   result == +1: (a == 0 && b == +1) || (a == +1 && b != -1)
    //
    // We can compute the result bits for all lanes in parallel:
    BinaryWord a0 = a.x0, a1 = a.x1, b0 = b.x0, b1 = b.x1;
    // Masks for a and b values
    BinaryWord a_is_m1 = ~(a0 | a1); // 00
    BinaryWord a_is_0  = (a0 & ~a1); // 01
    BinaryWord a_is_p1 = (a0 & a1);  // 11
    BinaryWord b_is_m1 = ~(b0 | b1);
    BinaryWord b_is_0  = (b0 & ~b1);
    BinaryWord b_is_p1 = (b0 & b1);

    // result == -1
    BinaryWord res_m1 = (a_is_m1 & ~b_is_p1) | (a_is_0 & b_is_m1);
    // result == 0
    BinaryWord res_0 = (a_is_m1 & b_is_p1) | (a_is_0 & b_is_0) | (a_is_p1 & b_is_m1);
    // result == +1
    BinaryWord res_p1 = (a_is_0 & b_is_p1) | (a_is_p1 & ~b_is_m1);

    // Encode: 00 = -1, 01 = 0, 11 = +1
    BinaryWord x0 = res_0 | res_p1;
    BinaryWord x1 = res_p1;
    return (TernaryWord){ .x0 = x0, .x1 = x1 };
}


// Addition mod 3 per lane
// Addition mod 3 in balanced ternary per lane
TernaryWord tritwiseRotate__by(TernaryWord a, TernaryWord b) {
    // Canonical encoding: 00 = -1, 01 = 0, 11 = +1
    BinaryWord a0 = a.x0, a1 = a.x1, b0 = b.x0, b1 = b.x1;
    BinaryWord a_is_m1 = ~(a0 | a1);
    BinaryWord a_is_0  = (a0 & ~a1);
    BinaryWord a_is_p1 = (a0 & a1);
    BinaryWord b_is_m1 = ~(b0 | b1);
    BinaryWord b_is_0  = (b0 & ~b1);
    BinaryWord b_is_p1 = (b0 & b1);

    // result == -1: (a == -1 && b == 0) || (a == 0 && b == -1) || (a == +1 && b == +1)
    BinaryWord res_m1 = (a_is_m1 & b_is_0) | (a_is_0 & b_is_m1) | (a_is_p1 & b_is_p1);
    // result == 0: (a == -1 && b == +1) || (a == 0 && b == 0) || (a == +1 && b == -1)
    BinaryWord res_0 = (a_is_m1 & b_is_p1) | (a_is_0 & b_is_0) | (a_is_p1 & b_is_m1);
    // result == +1: (a == -1 && b == -1) || (a == 0 && b == +1) || (a == +1 && b == 0)
    BinaryWord res_p1 = (a_is_m1 & b_is_m1) | (a_is_0 & b_is_p1) | (a_is_p1 & b_is_0);

    BinaryWord x0 = res_0 | res_p1;
    BinaryWord x1 = res_p1;
    return (TernaryWord){ .x0 = x0, .x1 = x1 };
}


// Balanced ternary multiplication per lane
TernaryWord tritwiseModulate__by(TernaryWord a, TernaryWord b) {
    // Canonical encoding: 00 = -1, 01 = 0, 11 = +1
    BinaryWord a0 = a.x0, a1 = a.x1, b0 = b.x0, b1 = b.x1;
    BinaryWord a_is_m1 = ~(a0 | a1);
    BinaryWord a_is_0  = (a0 & ~a1);
    BinaryWord a_is_p1 = (a0 & a1);
    BinaryWord b_is_m1 = ~(b0 | b1);
    BinaryWord b_is_0  = (b0 & ~b1);
    BinaryWord b_is_p1 = (b0 & b1);

    // result == -1: (a == -1 && b == +1) || (a == 0 && b == 0) || (a == +1 && b == -1)
    BinaryWord res_m1 = (a_is_m1 & b_is_p1) | (a_is_0 & b_is_0) | (a_is_p1 & b_is_m1);
    // result == 0: (a == 0) || (b == 0)
    BinaryWord res_0 = a_is_0 | b_is_0;
    // result == +1: (a == -1 && b == -1) || (a == +1 && b == +1)
    BinaryWord res_p1 = (a_is_m1 & b_is_m1) | (a_is_p1 & b_is_p1);

    BinaryWord x0 = res_0 | res_p1;
    BinaryWord x1 = res_p1;
    return (TernaryWord){ .x0 = x0, .x1 = x1 };
}
