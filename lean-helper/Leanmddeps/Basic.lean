namespace Leanmddeps

/--
Placeholder module for Lean-side dependency extraction tools.
The actual collector implementation will live here.
-/
def versionString : String := "0.1.0"

def baseDef : Nat := 7

theorem helperThm : baseDef = 7 := rfl

def wrappedDef : Nat := baseDef + 1

theorem usesHelper : baseDef = 7 := helperThm

end Leanmddeps
