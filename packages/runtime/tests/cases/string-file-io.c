#include "clawr_string.h"
#include "truthvalue.h"

#include <stdio.h>

int main() {
  String *path = String¸fromCString("/tmp/clawr-runtime-text-io.txt");
  String *content = String¸fromCString("hello clawr");

  truthvalue_t wrote = String¸writeTextFile(path, content);
  printf("write: %s\n", truthvalue·toCString(wrote));

  String *readBack = String¸readTextFile(path);
  printf("read-null: %s\n",
         truthvalue·toCString(readBack == NULL ? c_true : c_false));
  if (readBack) {
    printf("content: %s\n", String·toCString(readBack));
  }

  String *missingPath =
      String¸fromCString("/tmp/clawr-runtime-missing-file.txt");
  String *missing = String¸readTextFile(missingPath);
  printf("missing-null: %s\n",
         truthvalue·toCString(missing == NULL ? c_true : c_false));

  if (missing)
    releaseRC(missing);
  if (readBack)
    releaseRC(readBack);
  releaseRC(missingPath);
  releaseRC(content);
  releaseRC(path);

  return 0;
}
