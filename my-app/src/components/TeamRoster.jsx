import { useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { tournamentRequest } from "../utils/tournaments";
import { sportColors } from "../utils/sports";

const input = "border p-2 rounded-lg min-w-0";

// "#7 Marko Petrović · 8/2"
export const memberLabel = (member) =>
  [
    member.jersey_number !== null && member.jersey_number !== undefined ? `#${member.jersey_number}` : null,
    member.name,
  ]
    .filter(Boolean)
    .join(" ");

// Ime, broj na dresu i razred; isti obrazac za dodavanje i izmenu
function MemberForm({ initial, submitLabel, onSubmit, onCancel, buttonClass }) {
  const { t } = useTranslation();

  const [name, setName] = useState(initial?.name ?? "");
  const [number, setNumber] = useState(initial?.jersey_number ?? "");
  const [grade, setGrade] = useState(initial?.grade ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    const ok = await onSubmit({ name, jersey_number: number === "" ? null : Number(number), grade });

    setBusy(false);

    if (ok && !initial) {
      setName("");
      setNumber("");
      setGrade("");
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[4.5rem_1fr_6rem_auto] gap-2">
      <input
        type="number"
        min={0}
        max={99}
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder={t("teamRoster.number")}
        aria-label={t("teamRoster.jerseyNumber")}
        className={`${input} text-center`}
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("teamRoster.nameAndSurname")}
        aria-label={t("teamRoster.nameAndSurname")}
        required
        minLength={2}
        maxLength={60}
        className={input}
      />
      <input
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        placeholder={t("teamRoster.grade")}
        aria-label={t("teamRoster.grade")}
        maxLength={20}
        className={`${input} col-span-2 sm:col-span-1`}
      />
      <div className="col-span-2 sm:col-span-1 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 ${buttonClass} text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50`}
        >
          {!initial && <UserPlus size={16} />}
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50">
            {t("common.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}

// Igrači bez naloga (npr. učenici): upisuje ih kapiten ili organizator
function TeamRoster({ tournament, team, canEdit, onChange }) {
  const { t } = useTranslation();

  const [editing, setEditing] = useState(null);

  const members = team.members ?? [];
  const buttonClass = sportColors(tournament.sport).button;
  const total = team.players.length + members.length;
  const full = total >= tournament.max_roster;
  const base = `/${tournament.id}/teams/${team.id}/members`;

  const add = async (body) => {
    const ok = await tournamentRequest(base, { body, silent: true });

    if (ok) onChange();

    return ok;
  };

  const save = async (member, body) => {
    const ok = await tournamentRequest(`${base}/${member.id}`, { method: "PUT", body, silent: true });

    if (ok) {
      setEditing(null);
      onChange();
    }

    return ok;
  };

  const remove = async (member) => {
    if (!window.confirm(t("tournamentDetails.removePlayer", { name: member.name }))) return;

    if (await tournamentRequest(`${base}/${member.id}`, { method: "DELETE", silent: true })) onChange();
  };

  if (!canEdit && members.length === 0) return null;

  return (
    <div className="space-y-2">
      {members.length > 0 && (
        <ul className="divide-y border rounded-xl bg-white">
          {members.map((member) =>
            editing === member.id ? (
              <li key={member.id} className="p-2">
                <MemberForm
                  initial={member}
                  submitLabel={t("common.save")}
                  buttonClass={buttonClass}
                  onSubmit={(body) => save(member, body)}
                  onCancel={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-9 text-center font-bold text-gray-500">
                  {member.jersey_number ?? "–"}
                </span>
                <span className="flex-1 min-w-0 truncate">{member.name}</span>
                {member.grade && (
                  <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {member.grade}
                  </span>
                )}
                {canEdit && (
                  <span className="flex gap-1">
                    <button
                      onClick={() => setEditing(member.id)}
                      title={t("common.edit")}
                      aria-label={t("common.edit")}
                      className="p-1.5 rounded-full hover:bg-gray-100 text-gray-600"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(member)}
                      title={t("common.remove")}
                      aria-label={t("common.remove")}
                      className="p-1.5 rounded-full hover:bg-red-50 text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                )}
              </li>
            )
          )}
        </ul>
      )}

      {canEdit && !full && editing === null && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-700">{t("teamRoster.addPlayerWithoutAccount")}</p>
          <MemberForm submitLabel={t("teamRoster.add")} onSubmit={add} buttonClass={buttonClass} />
        </div>
      )}

      {canEdit && full && <p className="text-sm text-amber-700">{t("teamRoster.rosterFull")}</p>}
    </div>
  );
}

export default TeamRoster;
