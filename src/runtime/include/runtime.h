#ifndef CLAWR_RUNTIME_H
#define CLAWR_RUNTIME_H

#include "refc.h"
#include "clawr_string.h"
#include "integer.h"
#include "array.h"
#include "real.h"
#include "truthvalue.h"
#include "lanes.h"

// Utility functions for printing values, used in test cases.
// Remove when HasStringRepesentation is implemented for all types.
static void printTruthvalue(truthvalue_t value) {
    printf("%s\n", truthvalue·toCString(value));
}

static void printInteger(int64_t value) {
    printf("%lld\n", value);
}

#endif // CLAWR_RUNTIME_H
