def p_group : Prop := by
  /- the word sorry in a block comment should not count:
     sorry
  -/
  let msg := "sorry in a string should not count"
  sorry
