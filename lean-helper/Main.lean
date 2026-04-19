import Lean
import Leanmddeps
import Lean.Util.FoldConsts

open Lean

def parseName (s : String) : Name :=
  s.splitOn "." |>.foldl Name.str Name.anonymous

def collectDirectConstants (env : Environment) (declName : Name) : Except String (List Name) :=
  match env.find? declName with
  | none => .error s!"unknown declaration: {declName}"
  | some info =>
      .ok info.getUsedConstantsAsSet.toList

def main (args : List String) : IO UInt32 := do
  let moduleName :=
    match args with
    | moduleStr :: _ => parseName moduleStr
    | _ => `Leanmddeps
  let declName :=
    match args with
    | _ :: declStr :: _ => parseName declStr
    | _ => `Leanmddeps.usesHelper
  initSearchPath (← findSysroot)
  let env ← importModules #[{ module := moduleName }] {}
  match collectDirectConstants env declName with
  | .error msg =>
      IO.eprintln msg
      return 1
  | .ok names =>
      let constants := String.intercalate ",\n" <| names.map (fun n => s!"    \"{n}\"")
      IO.println "{"
      IO.println s!"  \"module\": \"{moduleName}\","
      IO.println s!"  \"declaration\": \"{declName}\","
      IO.println s!"  \"constants\": ["
      IO.println constants
      IO.println s!"  ]"
      IO.println "}"
      return 0
