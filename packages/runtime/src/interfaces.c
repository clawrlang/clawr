#include "interfaces.h"
#include "TruthValueBox.h"
#include "panic.h"

__attribute__((visibility("default")))
const __interface_info clawr¸Equatableˇtype = {.name = "clawr.Equatable"};
__attribute__((visibility("default")))
const __interface_info clawr¸HashEquatableˇtype = {.name = "clawr.HashEquatable"};
__attribute__((visibility("default")))
const __interface_info clawr¸Orderedˇtype = {.name = "clawr.Ordered"};
__attribute__((visibility("default")))
const __interface_info clawr¸HasStringRepresentationˇtype = {
    .name = "clawr.HasStringRepresentation"};
__attribute__((visibility("default")))
const __interface_info clawr¸Serializableˇtype = {.name = "clawr.Serializable"};
__attribute__((visibility("default")))
const __interface_info clawr¸Serializerˇtype = {.name = "clawr.Serializer"};

static const clawr¸Serializerˇwitness *serializerWitness(void *serializer) {
  if (!serializer)
    panic("Serialization requires a Serializer");
  const clawr¸Serializerˇwitness *witness =
      CONFORMANCE_ENTRY(serializer, clawr¸Serializer);
  if (!witness)
    panic("Value does not conform to Serializer");
  return witness;
}

#define SCALAR_SERIALIZABLE(Type, method, value)                              \
  static void Type##ˇserialize(void *self, void *serializer) {                \
    const clawr¸Serializerˇwitness *witness = serializerWitness(serializer);  \
    if (!witness->method)                                                     \
      panic("Serializer is missing " #method);                               \
    witness->method(serializer, value);                                      \
  }                                                                          \
  __attribute__((visibility("default")))                                     \
  const clawr¸Serializableˇwitness Type##ˇclawr¸Serializableˇwitness = {      \
      .serialize˛into = Type##ˇserialize,                                   \
  };                                                                         \
  const __interface_conformance_entry Type##ˇserializable_conformance = {     \
      .interface = &clawr¸Serializableˇtype,                                 \
      .witness_table = &Type##ˇclawr¸Serializableˇwitness,                    \
  };

SCALAR_SERIALIZABLE(Integer, writeInteger, (Integer *)self)
SCALAR_SERIALIZABLE(Real, writeReal, (Real *)self)
SCALAR_SERIALIZABLE(String, writeString, (String *)self)
SCALAR_SERIALIZABLE(TruthvalueBox, writeTruthvalue, ((TruthvalueBox *)self)->value)
