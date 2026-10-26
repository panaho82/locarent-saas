/** État renvoyé par les Server Actions (compatible useActionState). */
export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** erreurs par champ, prêtes à afficher sous les inputs */
  fieldErrors?: Record<string, string[]>;
};

export type AuthActionState = ActionState;

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };
export const IDLE_AUTH_STATE: AuthActionState = IDLE_ACTION_STATE;
