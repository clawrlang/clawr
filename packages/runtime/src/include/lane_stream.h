#ifndef CLAWR_LANE_STREAM_H
#define CLAWR_LANE_STREAM_H

#include "fields.h"

/// Shared opaque endpoints. Retaining aliases state; copyRC always panics.
typedef struct MemoryFieldStream clawr¸MemoryBitfieldInput;
typedef struct MemoryFieldStream clawr¸MemoryBitfieldOutput;
typedef struct MemoryFieldStream clawr¸MemoryTritfieldInput;
typedef struct MemoryFieldStream clawr¸MemoryTritfieldOutput;

extern const __type_info clawr¸MemoryBitfieldInputˇtype;
extern const __type_info clawr¸MemoryBitfieldOutputˇtype;
extern const __type_info clawr¸MemoryTritfieldInputˇtype;
extern const __type_info clawr¸MemoryTritfieldOutputˇtype;

/// Return an owned shared input retaining the borrowed field as a snapshot.
/// NULL or the wrong field kind panics. The initial cursor is lane zero.
clawr¸MemoryBitfieldInput *clawr¸newMemoryBitfieldInput(Field *value);
clawr¸MemoryTritfieldInput *clawr¸newMemoryTritfieldInput(Field *value);

/// Return an owned shared output initially containing an empty field.
clawr¸MemoryBitfieldOutput *clawr¸newMemoryBitfieldOutput(void);
clawr¸MemoryTritfieldOutput *clawr¸newMemoryTritfieldOutput(void);

/// Borrow inputs; return an owned field of at most maxLanes logical lanes.
/// Count must be positive and representable. Empty means terminal EOF.
/// Memory inputs return min(maxLanes, remaining). Invalid/closed handles,
/// invalid counts, and allocation failures panic, never masquerading as EOF.
Field *clawr¸readMemoryBits˛maxLanes(clawr¸MemoryBitfieldInput *input,
                                    Integer *maxLanes);
Field *clawr¸readMemoryTrits˛maxLanes(clawr¸MemoryTritfieldInput *input,
                                     Integer *maxLanes);

/// Append every lane in the borrowed field, without alignment or padding.
/// Empty matching-kind fields are no-ops. NULL, wrong-kind/closed handles,
/// mismatched fields, excessive total lengths, and allocation failures panic.
void clawr¸writeMemoryBits˛value(clawr¸MemoryBitfieldOutput *output, Field *value);
void clawr¸writeMemoryTrits˛value(clawr¸MemoryTritfieldOutput *output, Field *value);

/// Close the borrowed endpoint for all aliases; repeated close panics.
/// Input close releases its source; output close preserves its final snapshot.
/// Last release also frees retained fields, without requiring explicit close.
void clawr¸closeMemoryBitfieldInput(clawr¸MemoryBitfieldInput *input);
void clawr¸closeMemoryBitfieldOutput(clawr¸MemoryBitfieldOutput *output);
void clawr¸closeMemoryTritfieldInput(clawr¸MemoryTritfieldInput *input);
void clawr¸closeMemoryTritfieldOutput(clawr¸MemoryTritfieldOutput *output);

/// Return an owned immutable snapshot, borrowing an open or closed output.
/// Later writes or output destruction do not affect previously returned fields.
/// NULL or a wrong-kind/direction handle panics.
Field *clawr¸memoryBitfieldResult(clawr¸MemoryBitfieldOutput *output);
Field *clawr¸memoryTritfieldResult(clawr¸MemoryTritfieldOutput *output);

/// Runtime validation for the Clawr exact-read helpers; all arguments borrowed.
/// Count must be positive and representable. A chunk must make progress without
/// exceeding maxLanes; EOF here panics rather than returning a padded result.
void laneStreamCheckCount(Integer *count);
void laneStreamCheckRead˛maxLanes(Integer *length, Integer *maxLanes);

#endif
