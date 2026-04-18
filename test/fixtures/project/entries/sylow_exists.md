---
id: thm:sylow_exists
kind: theorem
title: Sylow existence
cluster: sylow
status: formalized
depends_on:
  informal:
    - def:p_group
  formal: []
used_by: []
blocked_by: []
lean:
  main_file: lean/GroupTheory/Sylow/thm_sylow_exists.lean
  main_decl: MyProject.GroupTheory.sylow_exists
---

# Informal statement

Let $G$ be a finite group with order divisible by $p$.

# Assumptions

- `G` is finite.

# Conclusion

`G` has a Sylow `p`-subgroup.

# Proof outline

Reduce to a counting argument.

# Key dependencies

- def:p_group

# Formalization notes

_TODO_

# Open gaps

_TODO_
