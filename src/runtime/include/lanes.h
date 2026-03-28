#ifndef CLAWR_LANES_H
#define CLAWR_LANES_H

#include "clawr_string.h"
#include <stdint.h>

typedef unsigned long long BinaryWord;
typedef struct {
    BinaryWord x0;
    BinaryWord x1;
} TernaryWord;

BinaryWord BinaryWord¸fromCString(const char* str, uint32_t length);
TernaryWord TernaryWord¸fromCString(const char* str, uint32_t length);

char* BinaryWord·toCString(BinaryWord value, uint32_t length);
char* TernaryWord·toCString(TernaryWord value, uint32_t length);

static inline BinaryWord bitwiseAnd(BinaryWord a, BinaryWord b) {
    return a & b;
}

static inline BinaryWord bitwiseOr(BinaryWord a, BinaryWord b) {
    return a | b;
}

static inline BinaryWord bitwiseNot(BinaryWord a, uint32_t length) {
    BinaryWord mask = (length == 64) ? ~0ULL : ((1ULL << length) - 1);
    return ~a & mask;
}

static inline TernaryWord tritwiseAnd(TernaryWord a, TernaryWord b) {
    return (TernaryWord) {
        .x0 = a.x0 & b.x0,
        .x1 = a.x1 & b.x1
    };
}

static inline TernaryWord tritwiseOr(TernaryWord a, TernaryWord b) {
    return (TernaryWord) {
        .x0 = a.x0 | b.x0,
        .x1 = a.x1 | b.x1
    };
}

static inline TernaryWord tritwiseNot(TernaryWord a, uint32_t length) {
    BinaryWord mask = (length == 64) ? ~0ULL : ((1ULL << length) - 1);
    return (TernaryWord) {
        .x0 = ~a.x1 & mask,
        .x1 = ~a.x0 & mask
    };
}

TernaryWord tritwiseAdjust__towards(TernaryWord a, TernaryWord b);
TernaryWord tritwiseRotate__by(TernaryWord a, TernaryWord b);
TernaryWord tritwiseModulate__by(TernaryWord a, TernaryWord b);

static inline TernaryWord tritwiseFilter__mask(TernaryWord a, BinaryWord mask) {
    // Where mask is 1: keep a; where mask is 0: set ambiguous (01)
    return (TernaryWord) {
        .x0 = (a.x0 & mask) | (~mask),
        .x1 = a.x1 & mask
    };
}

#endif // CLAWR_LANES_H
