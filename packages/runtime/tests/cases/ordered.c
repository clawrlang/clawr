#include "runtime.h"

typedef struct {
  __rc_header header;
  int value;
} OrderedValue;

typedef struct {
  int value;
} OrderedValueˇproperties;

static truthvalue_t before(void *left, void *right) {
  int a = ((OrderedValue *)left)->value;
  int b = ((OrderedValue *)right)->value;
  return a == b ? c_ambiguous : a < b ? c_true : c_false;
}

static const clawr¸Orderedˇwitness witness = {.isOrderedBefore = before};
static const __interface_conformance_entry conformance = {
    .interface = &clawr¸Orderedˇtype,
    .witness_table = &witness,
};
static const __type_info OrderedValueˇtype = {
    .data_type = {.size = sizeof(OrderedValue),
                  .conformances =
                      (const __interface_conformance_entry *[]){
                          &conformance, NULL}},
};

int main(void) {
  OrderedValue *a = allocInitRC(OrderedValue, 0, __rc_ISOLATED, .value = 1);
  OrderedValue *b = allocInitRC(OrderedValue, 0, __rc_ISOLATED, .value = 2);
  const clawr¸Orderedˇwitness *table = CONFORMANCE_ENTRY(a, clawr¸Ordered);
  truthvalue_t results[] = {
      table->isOrderedBefore(a, b),
      table->isOrderedBefore(b, a),
      table->isOrderedBefore(a, a),
  };
  for (int i = 0; i < 3; i++) {
    TruthvalueBox *box = boxTruthvalue(results[i]);
    print(box);
    releaseRC(box);
  }
  releaseRC(a);
  releaseRC(b);
}
