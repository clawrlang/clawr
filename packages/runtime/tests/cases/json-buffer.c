#include "runtime.h"
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

typedef struct {
  __rc_header header;
  clawr¸JSONBuffer *buffer;
  void *expected;
} TestSerializer;

static void writeString(void *self, String *value) {
  TestSerializer *serializer = self;
  assert(value == serializer->expected, "String transport changed");
  clawr¸jsonWriteString˛value(serializer->buffer, value);
}

static void writeInteger(void *self, Integer *value) {
  TestSerializer *serializer = self;
  assert(value == serializer->expected, "Integer transport changed");
  clawr¸jsonWriteInteger˛value(serializer->buffer, value);
}

static void writeReal(void *self, Real *value) {
  TestSerializer *serializer = self;
  assert(value == serializer->expected, "Real precision transport changed");
  clawr¸jsonWriteReal˛value(serializer->buffer, value);
}

static void writeTruthvalue(void *self, truthvalue_t value) {
  TestSerializer *serializer = self;
  assert(value == ((TruthvalueBox *)serializer->expected)->value,
         "Truthvalue transport changed");
  clawr¸jsonWriteTruthvalue˛value(serializer->buffer, value);
}

static const clawr¸Serializerˇwitness serializerWitness = {
    .writeString = writeString,
    .writeInteger = writeInteger,
    .writeReal = writeReal,
    .writeTruthvalue = writeTruthvalue,
};
static const __interface_conformance_entry serializerConformance = {
    .interface = &clawr¸Serializerˇtype,
    .witness_table = &serializerWitness,
};
static const __type_info serializerType = {
    .data_type = {
        .size = sizeof(TestSerializer),
        .conformances = (const __interface_conformance_entry *[]){
            &serializerConformance, NULL},
    },
};

static void checkScalar(void *value, String *expected) {
  clawr¸JSONBuffer *buffer = clawr¸newJSONBuffer();
  TestSerializer serializer = {
      .header = {.is_a = &serializerType},
      .buffer = buffer,
      .expected = value,
  };
  const clawr¸Serializableˇwitness *witness =
      CONFORMANCE_ENTRY(value, clawr¸Serializable);
  assert(witness && witness->serialize˛into, "Missing primitive conformance");
  witness->serialize˛into(value, &serializer);
  String *result = clawr¸jsonResult(buffer);
  assert(String¸eq(result, expected) == c_true, "Incorrect scalar JSON");
  releaseRC(result);
  releaseRC(buffer);
  releaseRC(expected);
}

static void testScalars(void) {
  String *text = String¸fromCString("quote:\" slash:\\\n\t\001 😀");
  checkScalar(text, String¸fromCString("\"quote:\\\" slash:\\\\\\n\\t\\u0001 😀\""));
  releaseRC(text);
  text = String¸fromBytes("a\0😀", sizeof("a\0😀") - 1);
  checkScalar(text, String¸fromCString("\"a\\u0000😀\""));
  releaseRC(text);
  Integer *integer =
      Integer¸fromCString("9007199254740993123456789012345678901234567890");
  checkScalar(integer, Integer·toStringRC(integer));
  releaseRC(integer);

  Real *reals[] = {
      Real¸fromString("1.23456789012345678901234567890123456789", 39, false),
      Real¸fromBinary(0.1, 53),
      Real¸fromStringBinary("0.123456789012345678901234567890123456789", 113),
      Real¸fromStringScale("0.333", 1, 3),
      Real¸fromStringScale("0.125", 3, 2),
  };
  for (size_t i = 0; i < sizeof reals / sizeof *reals; i++) {
    checkScalar(reals[i], Real·toStringRC(reals[i]));
    releaseRC(reals[i]);
  }
  const truthvalue_t values[] = {c_false, c_ambiguous, c_true};
  const char *expected[] = {"false", "null", "true"};
  for (size_t i = 0; i < 3; i++) {
    TruthvalueBox *box = boxTruthvalue(values[i]);
    checkScalar(box, String¸fromCString(expected[i]));
    releaseRC(box);
  }
}

static void testNesting(void) {
  clawr¸JSONBuffer *buffer = clawr¸newJSONBuffer();
  Integer *two = Integer¸fromInt64(2);
  String *name = String¸fromBytes("a\0b", 3);
  clawr¸jsonBeginStructure˛fieldCount(buffer, two);
  clawr¸jsonBeginField˛name(buffer, name);
  clawr¸jsonBeginStructure˛fieldCount(buffer, two);
  clawr¸jsonBeginField˛name(buffer, name);
  clawr¸jsonBeginStructure˛fieldCount(buffer, &Integer¸zero);
  clawr¸jsonEndStructure(buffer);
  clawr¸jsonEndField(buffer);
  clawr¸jsonBeginField˛name(buffer, name);
  clawr¸jsonWriteTruthvalue˛value(buffer, c_true);
  clawr¸jsonEndField(buffer);
  clawr¸jsonEndStructure(buffer);
  clawr¸jsonEndField(buffer);
  clawr¸jsonBeginField˛name(buffer, name);
  clawr¸jsonWriteString˛value(buffer, name);
  clawr¸jsonEndField(buffer);
  clawr¸jsonEndStructure(buffer);
  String *result = clawr¸jsonResult(buffer);
  assert(strcmp(result->data,
                "{\"a\\u0000b\":{\"a\\u0000b\":{},\"a\\u0000b\":true},"
                "\"a\\u0000b\":\"a\\u0000b\"}") == 0,
         "Nested JSON or embedded NUL escaping failed");
  releaseRC(result);
  releaseRC(buffer);
  releaseRC(name);
  releaseRC(two);

  buffer = clawr¸newJSONBuffer();
  clawr¸jsonBeginStructure˛fieldCount(buffer, &Integer¸zero);
  clawr¸jsonEndStructure(buffer);
  result = clawr¸jsonResult(buffer);
  assert(strcmp(result->data, "{}") == 0, "Empty root structure failed");
  releaseRC(result);
  releaseRC(buffer);

  JSONWriter writer = {.data = malloc(4), .length = 3, .capacity = 4};
  memcpy(writer.data, "a\0b", 4);
  result = JSONWriter¸finish(&writer);
  assert(result->length == 3 && memcmp(result->data, "a\0b", 4) == 0,
         "JSONWriter result truncated embedded NUL");
  releaseRC(result);
}

static void testAbandonment(void) {
  Integer *count = Integer¸fromCString("123456789012345678901234567890");
  String *name = String¸fromCString("nested");
  refs_t refs = atomic_load(&count->header.refs);
  for (int i = 0; i < 100; i++) {
    clawr¸JSONBuffer *buffer = clawr¸newJSONBuffer();
    assert(RC_HEADER(buffer)->is_a == &clawr¸JSONBufferˇtype,
           "Wrong JSONBuffer identity");
    __rc_proxy *weak = retainWeakly(buffer);
    for (int depth = 0; depth < 8; depth++) {
      clawr¸jsonBeginStructure˛fieldCount(buffer, count);
      clawr¸jsonBeginField˛name(buffer, name);
    }
    releaseRC(buffer);
    assert(weak->target == NULL, "Abandoned buffer was not released");
    assert(atomic_load(&count->header.refs) == refs, "Abandoned frames leaked");
    releaseProxy(weak);
  }
  releaseRC(count);
  releaseRC(name);
}

static void misuse(int scenario) {
  clawr¸JSONBuffer *buffer = clawr¸newJSONBuffer();
  Integer *one = Integer¸fromInt64(1);
  Integer *negative = Integer¸fromInt64(-1);
  String *name = String¸fromCString("x");
  switch (scenario) {
  case 0: clawr¸jsonResult(buffer); break;
  case 1:
    clawr¸jsonWriteTruthvalue˛value(buffer, c_true);
    clawr¸jsonWriteTruthvalue˛value(buffer, c_false);
    break;
  case 2: clawr¸jsonBeginStructure˛fieldCount(buffer, negative); break;
  case 3: clawr¸jsonBeginField˛name(buffer, name); break;
  case 4: clawr¸jsonEndField(buffer); break;
  case 5: clawr¸jsonEndStructure(buffer); break;
  case 6:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonWriteTruthvalue˛value(buffer, c_true);
    break;
  case 7:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonEndStructure(buffer);
    break;
  case 8:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonResult(buffer);
    break;
  case 9:
    clawr¸jsonBeginStructure˛fieldCount(buffer, &Integer¸zero);
    clawr¸jsonBeginField˛name(buffer, name);
    break;
  case 10: case 11: case 12: case 13: case 14:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonBeginField˛name(buffer, name);
    if (scenario == 10) clawr¸jsonEndField(buffer);
    if (scenario == 11) clawr¸jsonBeginField˛name(buffer, name);
    if (scenario == 12) clawr¸jsonEndStructure(buffer);
    clawr¸jsonWriteTruthvalue˛value(buffer, c_true);
    if (scenario == 13) clawr¸jsonWriteTruthvalue˛value(buffer, c_false);
    clawr¸jsonResult(buffer);
    break;
  case 15:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonBeginField˛name(buffer, name);
    clawr¸jsonBeginStructure˛fieldCount(buffer, &Integer¸zero);
    clawr¸jsonEndField(buffer);
    break;
  case 25: case 26: case 27:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonBeginField˛name(buffer, name);
    clawr¸jsonWriteTruthvalue˛value(buffer, c_true);
    if (scenario == 27) clawr¸jsonEndStructure(buffer);
    clawr¸jsonEndField(buffer);
    if (scenario == 25) clawr¸jsonEndField(buffer);
    clawr¸jsonBeginField˛name(buffer, name);
    break;
  case 28:
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonBeginField˛name(buffer, name);
    clawr¸jsonBeginStructure˛fieldCount(buffer, one);
    clawr¸jsonEndStructure(buffer);
    break;
  case 29:
    clawr¸jsonWriteTruthvalue˛value(buffer, (truthvalue_t)99);
    break;
  default: {
    clawr¸jsonWriteTruthvalue˛value(buffer, c_true);
    String *result = clawr¸jsonResult(buffer);
    releaseRC(result);
    switch (scenario) {
    case 16: clawr¸jsonResult(buffer); break;
    case 17: clawr¸jsonWriteString˛value(buffer, name); break;
    case 18: clawr¸jsonWriteInteger˛value(buffer, one); break;
    case 19: clawr¸jsonWriteReal˛value(buffer, NULL); break;
    case 20: clawr¸jsonWriteTruthvalue˛value(buffer, c_false); break;
    case 21: clawr¸jsonBeginStructure˛fieldCount(buffer, one); break;
    case 22: clawr¸jsonBeginField˛name(buffer, name); break;
    case 23: clawr¸jsonEndField(buffer); break;
    case 24: clawr¸jsonEndStructure(buffer); break;
    }
  }
  }
}

static void testPanics(void) {
  for (int scenario = 0; scenario < 30; scenario++) {
    int output[2];
    assert(pipe(output) == 0, "pipe failed");
    pid_t pid = fork();
    assert(pid >= 0, "fork failed");
    if (pid == 0) {
      close(output[0]);
      assert(dup2(output[1], STDERR_FILENO) >= 0, "dup2 failed");
      close(output[1]);
      misuse(scenario);
      _exit(0);
    }
    close(output[1]);
    char message[256] = {0};
    ssize_t length = read(output[0], message, sizeof(message) - 1);
    close(output[0]);
    int status;
    assert(waitpid(pid, &status, 0) == pid, "waitpid failed");
    assert(WIFEXITED(status) && WEXITSTATUS(status) == EXIT_FAILURE,
           "JSON misuse did not panic");
    assert(length > 0 && strncmp(message, "PANIC: ", 7) == 0,
           "JSON misuse did not use runtime panic");
  }
}

int main(void) {
  testScalars();
  testNesting();
  testAbandonment();
  testPanics();
  return 0;
}
