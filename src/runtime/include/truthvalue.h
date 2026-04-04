#ifndef CLAWR_TRUTHVALUE_H
#define CLAWR_TRUTHVALUE_H

#define c_false -1
#define c_ambiguous 0
#define c_true 1

typedef int truthvalue_t;

static inline truthvalue_t adjust__towards(truthvalue_t value, truthvalue_t towards) {
    if (towards == c_true) return value == c_false ? c_ambiguous: c_true;
    if (towards == c_false) return value == c_true ? c_ambiguous: c_false;
    return value; // towards is ambiguous, no change
}

static inline truthvalue_t rotate__by(truthvalue_t value, truthvalue_t by) {
    return (value + by + 4) % 3 - 1; // rotate in balanced ternary
}

static inline truthvalue_t modulate__by(truthvalue_t value, truthvalue_t by) {
    return value * by;
}

static inline truthvalue_t truthvalue¸and(truthvalue_t a, truthvalue_t b) {
    return a < b ? a : b;
}

static inline truthvalue_t truthvalue¸or(truthvalue_t a, truthvalue_t b) {
    return a > b ? a : b;
}

const char* truthvalue·toCString(truthvalue_t value);

#endif // CLAWR_TRUTHVALUE_H
