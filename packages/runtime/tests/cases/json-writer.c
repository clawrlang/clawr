#include <stdio.h>

#include "runtime.h"

int main(void) {
  JSONWriter writer;
  JSONWriter¸init(&writer);
  JSONWriter¸appendRaw(&writer, "{\"text\":");
  String *text = String¸fromCString("quote:\" slash:\\ newline:\n tab:\t control:\001");
  JSONWriter¸appendString(&writer, text);
  releaseRC(text);

  JSONWriter¸appendRaw(&writer, ",\"integer\":");
  Integer *integer = Integer¸fromCString("9007199254740993");
  JSONWriter¸appendInteger(&writer, integer);
  releaseRC(integer);

  JSONWriter¸appendRaw(&writer, ",\"real\":");
  Real *real = Real¸fromStringScale("0.333", 1, 3);
  JSONWriter¸appendReal(&writer, real);
  releaseRC(real);

  JSONWriter¸appendRaw(&writer, ",\"truth\":");
  JSONWriter¸appendTruthvalue(&writer, c_ambiguous);
  JSONWriter¸appendRaw(&writer, "}");

  String *json = JSONWriter¸finish(&writer);
  puts(String·toCString(json));
  releaseRC(json);
  return 0;
}
