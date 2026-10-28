"use client";
import { useActionState } from "react";
import { addFavorite } from "@/app/(private)/dashboard/actions";
export function FavoriteForm() {
  const [state, action, pending] = useActionState(addFavorite, { message: "" });
  return (
    <form action={action}>
      <label htmlFor="ticker">Adicionar ticker à lista de estudo</label>
      <div className="input-row">
        <input
          id="ticker"
          name="ticker"
          placeholder="Ex.: PETR4"
          maxLength={6}
          required
          pattern="[A-Za-z]{4}[0-9]{1,2}"
        />
        <button disabled={pending}>
          {pending ? "Salvando…" : "Adicionar"}
        </button>
      </div>
      <p role="status">{state.message}</p>
    </form>
  );
}
