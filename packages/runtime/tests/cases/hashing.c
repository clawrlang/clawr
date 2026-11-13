#include "runtime.h"
#include <assert.h>
#include <string.h>

static HashBuilder *builder(void) {
  return HashBuilder¸withKey(UINT64_C(0x0706050403020100),
                            UINT64_C(0x0f0e0d0c0b0a0908));
}

static uint64_t hash(void *value) {
  HashBuilder *b = builder();
  clawr¸HashBuilder·add(b, value);
  uint64_t result = HashBuilder¸snapshot(b);
  releaseRC(b);
  return result;
}

typedef struct {
  __rc_header header;
  Integer *value;
} Key;

static truthvalue_t keyEquals(void *left, void *right) {
  return Integer¸eq(((Key *)left)->value, ((Key *)right)->value);
}

static unsigned calls;
static void keyHash(void *self, HashBuilder *b) {
  calls++;
  // Deliberately collide: unequal keys may have identical contributions.
  clawr¸HashBuilder·add(b, &Integer¸zero);
}

static const clawr¸HashEquatableˇwitness keyWitness = {
    .equals = keyEquals, .hash˛into = keyHash,
};
static const __interface_conformance_entry keyConformance = {
    .interface = &clawr¸HashEquatableˇtype, .witness_table = &keyWitness,
};
static const __type_info keyType = {
    .data_type = {
        .size = sizeof(Key),
        .conformances = (const __interface_conformance_entry *[]){
            &keyConformance, NULL,
        },
    },
};

int main(void) {
  unsigned char bytes[64];
  for (unsigned i = 0; i < sizeof(bytes); i++) bytes[i] = i;
  HashBuilder *b = builder();
  assert(HashBuilder¸snapshot(b) == UINT64_C(0x726fdb47dd0e0e31));
  HashBuilder¸appendBytes(b, bytes, 15);
  assert(HashBuilder¸snapshot(b) == UINT64_C(0xa129ca6149be45e5));
  assert(HashBuilder¸snapshot(b) == UINT64_C(0xa129ca6149be45e5));
  HashBuilder¸appendBytes(b, bytes + 15, 48);
  assert(HashBuilder¸snapshot(b) == UINT64_C(0x958a324ceb064572));
  HashBuilder *fresh = builder();
  HashBuilder¸appendBytes(fresh, bytes, 63);
  assert(HashBuilder¸snapshot(b) == HashBuilder¸snapshot(fresh));
  releaseRC(b);
  releaseRC(fresh);

  Integer *one = Integer¸fromInt64(1);
  Integer *two = Integer¸fromInt64(2);
  Integer *big = Integer¸fromCString("123456789012345678901234567890");
  Integer *sameBig = Integer¸fromCString("000123456789012345678901234567890");
  assert(hash(big) == hash(sameBig));
  Real *decimal = Real¸fromString("1.000", 3, true);
  Real *binary = Real¸fromStringBinary("1", 80);
  Real *ternary = Real¸fromStringScale("1", 7, 3);
  assert(Real¸compare(decimal, binary) == 0);
  assert(Real¸compare(decimal, ternary) == 0);
  assert(hash(one) == hash(decimal));
  assert(hash(decimal) == hash(binary));
  assert(hash(decimal) == hash(ternary));
  Real *zero = Real¸fromString("-0.000", 3, true);
  assert(hash(zero) == hash(&Integer¸zero));
  Real *huge = Real¸fromString("1e100000000000000000000", 3, false);
  Real *sameHuge = Real¸fromString("10e99999999999999999999", 3, false);
  assert(hash(huge) == hash(sameHuge));
  Real *third = Real¸fromStringScale("0.333", 1, 3);
  Real *sameThird = Real¸fromStringScale("0.333", 3, 3);
  assert(Real¸compare(third, sameThird) == 0);
  assert(hash(third) == hash(sameThird));
  assert(Integer·toInt64(one) == 1);

  TruthvalueBox *truths[] = {
      boxTruthvalue(c_false), boxTruthvalue(c_ambiguous), boxTruthvalue(c_true),
  };
  for (unsigned i = 0; i < 3; i++) {
    TruthvalueBox *same = boxTruthvalue(truths[i]->value);
    assert(hash(truths[i]) == hash(same));
    const clawr¸Equatableˇwitness *eq = CONFORMANCE_ENTRY(same, clawr¸Equatable);
    assert(eq && eq->equals(same, truths[i]) == c_true);
    releaseRC(same);
    releaseRC(truths[i]);
  }

  String *ab = String¸fromCString("ab");
  String *c = String¸fromCString("c");
  String *a = String¸fromCString("a");
  String *bc = String¸fromCString("bc");
  String *embedded = String¸fromCString("abc");
  embedded->data[1] = '\0';
  assert(String¸eq(a, embedded) == c_false);
  b = builder(); fresh = builder();
  clawr¸HashBuilder·add(b, ab); clawr¸HashBuilder·add(b, c);
  clawr¸HashBuilder·add(fresh, a); clawr¸HashBuilder·add(fresh, bc);
  // Fixed key, representative framing/order regression (not collision freedom).
  assert(HashBuilder¸snapshot(b) != HashBuilder¸snapshot(fresh));
  releaseRC(b); releaseRC(fresh);

  Key k1 = {.header = {.is_a = &keyType}, .value = one};
  Key k2 = {.header = {.is_a = &keyType}, .value = two};
  assert(hash(&k1) == hash(&k2));
  assert(calls == 2);
  assert(keyEquals(&k1, &k2) == c_false);

  b = clawr¸newHashBuilder(); fresh = clawr¸newHashBuilder();
  clawr¸HashBuilder·add(b, one); clawr¸HashBuilder·add(fresh, one);
  assert(HashBuilder¸snapshot(b) == HashBuilder¸snapshot(fresh));
  HashBuilder *alias = retainRC(b);
  __rc_proxy *weak = retainWeakly(b);
  releaseRC(b);
  clawr¸HashBuilder·add(alias, two);
  clawr¸HashBuilder·add(fresh, two);
  assert(HashBuilder¸snapshot(alias) == HashBuilder¸snapshot(fresh));
  releaseRC(alias);
  assert(weak->target == NULL);
  releaseProxy(weak); releaseRC(fresh);

  releaseRC(one); releaseRC(two); releaseRC(big); releaseRC(sameBig);
  releaseRC(decimal); releaseRC(binary); releaseRC(ternary); releaseRC(zero);
  releaseRC(huge); releaseRC(sameHuge); releaseRC(third); releaseRC(sameThird);
  releaseRC(ab); releaseRC(c); releaseRC(a); releaseRC(bc); releaseRC(embedded);
}
