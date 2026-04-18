---
id: thm:sylow_exists
kind: theorem
title: Sylow existence
cluster: sylow
status: incomplete
depends_on:
  informal:
    - def:p_group
    - thm:orbit_stabilizer
  formal: []
used_by: []
blocked_by: []
lean:
  main_file: GroupTheory/Sylow/thm_sylow_exists.lean
  main_decl: MyProject.GroupTheory.sylow_exists
---

# Informal statement

Let $G$ be a finite group with order divisible by $p$.

# Assumptions

- `G` is finite.
- `p` is prime.

# Conclusion

`G` has a Sylow `p`-subgroup.

# Proof outline

Reduce to a counting argument using a group action.

# Key dependencies

- def:p_group
- thm:orbit_stabilizer

# Formalization notes

_TODO_

# Open gaps

_TODO_
