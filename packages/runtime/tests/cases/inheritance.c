#include "runtime.h"
#include <stdio.h>

// ```clawr
// object Prism {
//     abstract func area() -> integer
//     func volume() -> integer
// init:
//     func new(height: integer @range(0..20))
// state:
//     height: integer
// }
// ```
typedef struct Prismˇfields {
  int height;
} Prismˇfields;
typedef struct Prism {
  __rc_header header;
  int height;
} Prism;
static const __type_info Prismˇtype = {.polymorphic_type = {
                                           .data = {.size = sizeof(Prism)},
                                           .super = NULL,
                                       }};
typedef int (*Prism·areaˇmethod)(void *self);

typedef struct Prismˇvtable {
  Prism·areaˇmethod area;
} Prismˇvtable;

// Clawr: `init: func new(height: integer @range(0..20))`
Prism *Prism˛new_height(void *self, int height) {
  // Clawr: `self = { height }`
  memcpy(((__rc_header *)self) + 1,
         &(Prismˇfields){
             .height = height,
         },
         sizeof(Prism) - sizeof(__rc_header));
  return self;
}

// Clawr: `func volume() -> integer`
int Prism·volume(Prism *self) {
  return VTABLE(self, Prism)->area(self) * self->height;
}

// ```clawr
// object RectBlock: Prism {
//     func area() => self.width * self.depth
// state:
//     width: integer
//     depth: integer
// }
// ```
typedef struct RectBlockˇfields {
  int width;
  int depth;
} RectBlockˇfields;
typedef struct RectBlock {
  Prism super;
  RectBlockˇfields fields;
} RectBlock;

// Clawr: `func area() => self.width * self.depth`
int RectBlock·area(RectBlock *self) {
  return self->fields.width * self->fields.depth;
}

static __type_info RectBlockˇtype = {
    .polymorphic_type = {
        .data = {.size = sizeof(RectBlock)},
        .super = &Prismˇtype.polymorphic_type,
        .vtable =
            &(Prismˇvtable){
                .area = (Prism·areaˇmethod)RectBlock·area,
            },
    }};

// Clawr: `func new(width: integer, depth: integer, height: integer) ->
// RectBlock`
RectBlock *RectBlock¸new_width_depth_height(int width, int depth, int height) {
  RectBlock *result = allocInitRC(RectBlock, 0, __rc_ISOLATED);
  memcpy(&result->fields,
         &(RectBlockˇfields){
             .width = width,
             .depth = depth,

         },
         sizeof(RectBlockˇfields));
  Prism˛new_height(result, height);
  return result;
}

int main() {
  // Clawr: `const x = RectBlock.new(width: 3, depth: 4, height: 5)`
  void *x = RectBlock¸new_width_depth_height(3, 4, 5);

  printf("%d\n", VTABLE(x, Prism)->area(x));
  printf("%d\n", Prism·volume(x));
}
