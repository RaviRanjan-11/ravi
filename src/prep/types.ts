export type Difficulty = 'Intermediate' | 'Advanced' | 'Senior' | 'Expert'
export type ProblemKind =
  | 'Debug'
  | 'Predict'
  | 'Design'
  | 'Incident'
  | 'Review'
  | 'Performance'
  | 'Architecture'
  | 'Judgment'

export type FollowUp = { q: string; a: string }

export type Problem = {
  id: string
  title: string
  difficulty: Difficulty
  kind: ProblemKind
  prompt: string
  think: string[]
  solution: string
  explanation: string
  internals: string
  testing: string
  pitfalls: string
  alternatives: string
  tradeoffs: string
  followups: FollowUp[]
  teaches: string[]
}

export type PrepDay = {
  id: string
  title: string
  kicker: string
  intro: string
  problems: Problem[]
  hideSolutions?: boolean
}
