#include "hash.h"
#include "TruthValueBox.h"
#include "integer.h"
#include "real.h"
#include "panic.h"
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uint64_t v0, v1, v2, v3;
  uint64_t tail;
  uint64_t length;
  unsigned used;
} HashState;

struct HashBuilder {
  __rc_header header;
  HashState state;
};
typedef struct { HashState state; } HashBuilderˇproperties;

__attribute__((visibility("default"))) const __type_info HashBuilderˇtype = {
    .data_type = {.size = sizeof(HashBuilder)},
};

static uint64_t rotate(uint64_t value, unsigned bits) {
  return (value << bits) | (value >> (64 - bits));
}

static void roundState(HashState *s) {
  s->v0 += s->v1; s->v1 = rotate(s->v1, 13);
  s->v1 ^= s->v0; s->v0 = rotate(s->v0, 32);
  s->v2 += s->v3; s->v3 = rotate(s->v3, 16); s->v3 ^= s->v2;
  s->v0 += s->v3; s->v3 = rotate(s->v3, 21); s->v3 ^= s->v0;
  s->v2 += s->v1; s->v1 = rotate(s->v1, 17);
  s->v1 ^= s->v2; s->v2 = rotate(s->v2, 32);
}

static void compress(HashState *s, uint64_t word) {
  s->v3 ^= word;
  roundState(s); roundState(s);
  s->v0 ^= word;
}

__attribute__((visibility("default")))
HashBuilder *HashBuilder¸withKey(uint64_t key0, uint64_t key1) {
  return allocInitRC(HashBuilder, 0, __rc_SHARED, .state = {
      .v0 = key0 ^ UINT64_C(0x736f6d6570736575),
      .v1 = key1 ^ UINT64_C(0x646f72616e646f6d),
      .v2 = key0 ^ UINT64_C(0x6c7967656e657261),
      .v3 = key1 ^ UINT64_C(0x7465646279746573),
  });
}

static pthread_once_t keyOnce = PTHREAD_ONCE_INIT;
static uint64_t processKey[2];
static void initializeKey(void) { arc4random_buf(processKey, sizeof(processKey)); }

__attribute__((visibility("default"))) HashBuilder *clawr¸newHashBuilder(void) {
  if (pthread_once(&keyOnce, initializeKey) != 0)
    panic("Unable to initialize hashing context");
  return HashBuilder¸withKey(processKey[0], processKey[1]);
}

__attribute__((visibility("default")))
void HashBuilder¸appendBytes(HashBuilder *self, const void *bytes, size_t length) {
  if (!self || (!bytes && length))
    panic("Invalid hash input");
  const unsigned char *p = bytes;
  HashState *s = &self->state;
  s->length += length;
  for (size_t i = 0; i < length; i++) {
    s->tail |= (uint64_t)p[i] << (8 * s->used++);
    if (s->used == 8) {
      compress(s, s->tail);
      s->tail = 0;
      s->used = 0;
    }
  }
}

__attribute__((visibility("default")))
uint64_t HashBuilder¸snapshot(const HashBuilder *self) {
  if (!self) panic("Invalid hash builder");
  HashState s = self->state;
  compress(&s, s.tail | (s.length << 56));
  s.v2 ^= 0xff;
  for (unsigned i = 0; i < 4; i++) roundState(&s);
  return s.v0 ^ s.v1 ^ s.v2 ^ s.v3;
}

static void frame(HashBuilder *builder, unsigned char tag,
                  const void *bytes, size_t length) {
  unsigned char encodedLength[8];
  for (unsigned i = 0; i < 8; i++)
    encodedLength[i] = (uint64_t)length >> (8 * i);
  HashBuilder¸appendBytes(builder, &tag, 1);
  HashBuilder¸appendBytes(builder, encodedLength, sizeof(encodedLength));
  HashBuilder¸appendBytes(builder, bytes, length);
}

static void integerPart(HashBuilder *builder, Integer *value) {
  String *text = Integer·toStringRC(value);
  frame(builder, 1, text->data, text->length);
  releaseRC(text);
}

// Canonical numeric value: coefficient * 2^a * 3^b * 5^c.
// Factoring the coefficient avoids expanding an arbitrarily large exponent.
static void number(HashBuilder *builder, Integer *coefficient,
                   Integer *exp10, size_t ternaryScale, bool ternary) {
  Integer *rest = copyRC(coefficient, __rc_ISOLATED);
  Integer *exponents[3] = {
      ternary ? Integer¸fromInt64(0) : retainRC(exp10),
      Integer¸fromInt64(0),
      ternary ? Integer¸fromInt64(0) : retainRC(exp10),
  };
  if (ternary) {
    char text[3 * sizeof(size_t) + 2];
    snprintf(text, sizeof(text), "-%zu", ternaryScale);
    releaseRC(exponents[1]);
    exponents[1] = Integer¸fromCString(text);
  }
  const digit_t primes[] = {2, 3, 5};
  if (Integer¸compare(rest, &Integer¸zero) == 0) {
    for (unsigned i = 0; i < 3; i++) {
      releaseRC(exponents[i]);
      exponents[i] = Integer¸fromInt64(0);
    }
  } else {
    Integer *one = Integer¸fromInt64(1);
    for (unsigned i = 0; i < 3; i++) {
      for (;;) {
        Integer *quotient = copyRC(rest, __rc_ISOLATED);
        if (Integer·divide(quotient, primes[i]) != 0) {
          releaseRC(quotient);
          break;
        }
        releaseRC(rest);
        rest = quotient;
        Integer *next = Integer¸add(exponents[i], one);
        releaseRC(exponents[i]);
        exponents[i] = next;
      }
    }
    releaseRC(one);
  }
  const unsigned char numericTag = 0;
  HashBuilder¸appendBytes(builder, &numericTag, 1);
  integerPart(builder, rest);
  releaseRC(rest);
  for (unsigned i = 0; i < 3; i++) {
    integerPart(builder, exponents[i]);
    releaseRC(exponents[i]);
  }
}

static void hashInteger(void *self, HashBuilder *builder) {
  number(builder, self, &Integer¸zero, 0, false);
}
static void hashReal(void *self, HashBuilder *builder) {
  Real *value = self;
  number(builder, value->significand, value->exponent10,
         value->precision, value->grid_base == 3);
}
static void hashString(void *self, HashBuilder *builder) {
  String *value = self;
  frame(builder, 2, value->data, value->length);
}
static void hashTruthvalue(void *self, HashBuilder *builder) {
  truthvalue_t value = ((TruthvalueBox *)self)->value;
  unsigned char logical = value == c_false ? 0 : value == c_true ? 2 : 1;
  frame(builder, 3, &logical, 1);
}

static truthvalue_t equalInteger(void *left, void *right) {
  return RC_HEADER(right)->is_a == &Integerˇtype
      ? Integer¸eq(left, right) : c_false;
}
static truthvalue_t equalReal(void *left, void *right) {
  return RC_HEADER(right)->is_a == &Realˇtype &&
      Real¸compare(left, right) == 0 ? c_true : c_false;
}
static truthvalue_t equalString(void *left, void *right) {
  return RC_HEADER(right)->is_a == &Stringˇtype ? String¸eq(left, right) : c_false;
}
static truthvalue_t equalTruthvalue(void *left, void *right) {
  return RC_HEADER(right)->is_a == &TruthvalueBoxˇtype &&
      ((TruthvalueBox *)left)->value == ((TruthvalueBox *)right)->value
          ? c_true : c_false;
}

#define HASH_CONFORMANCES(Type, Equal, Hash) \
  static const clawr¸HashEquatableˇwitness Type##HashWitness = { \
      .equals = Equal, .hash˛into = Hash, \
  }; \
  static const clawr¸Equatableˇwitness Type##EqualWitness = {.equals = Equal}; \
  __attribute__((visibility("default"))) \
  const __interface_conformance_entry Type##ˇhash_conformance = { \
      .interface = &clawr¸HashEquatableˇtype, .witness_table = &Type##HashWitness, \
  }; \
  __attribute__((visibility("default"))) \
  const __interface_conformance_entry Type##ˇequal_conformance = { \
      .interface = &clawr¸Equatableˇtype, .witness_table = &Type##EqualWitness, \
  }

HASH_CONFORMANCES(Integer, equalInteger, hashInteger);
HASH_CONFORMANCES(Real, equalReal, hashReal);
HASH_CONFORMANCES(String, equalString, hashString);
HASH_CONFORMANCES(TruthvalueBox, equalTruthvalue, hashTruthvalue);

__attribute__((visibility("default")))
void clawr¸HashBuilder·add(HashBuilder *self, void *value) {
  if (!self || !value) panic("Invalid hash contribution");
  const __type_info *type = RC_HEADER(value)->is_a;
  if (type == &Integerˇtype) hashInteger(value, self);
  else if (type == &Realˇtype) hashReal(value, self);
  else if (type == &Stringˇtype) hashString(value, self);
  else if (type == &TruthvalueBoxˇtype) hashTruthvalue(value, self);
  else {
    const clawr¸HashEquatableˇwitness *witness =
        CONFORMANCE_ENTRY(value, clawr¸HashEquatable);
    if (!witness) panic("Value does not conform to HashEquatable");
    witness->hash˛into(value, self);
  }
}
