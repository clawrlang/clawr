#ifndef CLAWR_RUNTIME_H
#define CLAWR_RUNTIME_H

#include "array.h"
#include "clawr_string.h"
#include "integer.h"
#include "lanes.h"
#include "protocols.h"
#include "real.h"
#include "refc.h"
#include "truthvalue.h"

// Utility functions for printing values, used in test cases.
// Remove when HasStringRepesentation is implemented for all types.
static void printTruthvalue(truthvalue_t value) {
  printf("%s\n", truthvalue·toCString(value));
}

static void printInt64(int64_t value) { printf("%lld\n", value); }

static void *copy˛of(void *value) { return copyRC(value, __rc_SHARED); }

#endif // CLAWR_RUNTIME_H
