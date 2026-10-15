"use server";

import { refresh } from "next/cache";
import { currentNow } from "@/lib/data";
import * as db from "@/lib/db";
import {
  nextPunchType,
  OVERRIDE_LABELS,
  type OverrideKind,
  type PunchType,
  toTime,
  validateSequence,
} from "@/lib/hours";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isType = (v: unknown): v is PunchType => v === "in" || v === "out";
const typeLabel = (t: PunchType) => (t === "in" ? "Entrada" : "Saída");

/** Bate o ponto agora; o tipo é o oposto da última batida do dia. */
export async function clockPunch(): Promise<ActionResult> {
  const now = currentNow();
  const time = toTime(now.minutes);
  const today = db.punchesOn(now.date);
  if (today.some((p) => p.time === time)) {
    return { ok: false, error: `Já existe uma batida às ${time}. Aguarde um minuto.` };
  }
  const type = nextPunchType(today);
  db.insertPunch({ date: now.date, time, type, source: "clock" });
  refresh();
  return { ok: true, message: `${typeLabel(type)} registrada às ${time}.` };
}

type PunchInput = { date: string; time: string; type: PunchType; note?: string };

function checkInput(input: PunchInput): string | null {
  if (!DATE_RE.test(input.date)) return "Data inválida.";
  if (!TIME_RE.test(input.time)) return "Horário inválido.";
  if (!isType(input.type)) return "Informe se é entrada ou saída.";
  return null;
}

/**
 * Valida o dia resultante. Se o dia já estava inconsistente, qualquer alteração
 * é aceita para permitir corrigi-lo aos poucos.
 */
function checkSequence(
  before: { time: string; type: PunchType }[],
  after: { time: string; type: PunchType }[],
) {
  const error = validateSequence(after);
  if (!error) return null;
  const duplicate = new Set(after.map((p) => p.time)).size !== after.length;
  if (!duplicate && validateSequence(before)) return null;
  return error;
}

export async function addPunch(input: PunchInput): Promise<ActionResult> {
  const invalid = checkInput(input);
  if (invalid) return { ok: false, error: invalid };
  const day = db.punchesOn(input.date);
  const error = checkSequence(day, [...day, input]);
  if (error) return { ok: false, error };
  db.insertPunch({ ...input, source: "manual" });
  refresh();
  return { ok: true, message: `${typeLabel(input.type)} às ${input.time} adicionada.` };
}

export async function editPunch(
  id: number,
  input: Omit<PunchInput, "date">,
): Promise<ActionResult> {
  const current = db.getPunch(id);
  if (!current) return { ok: false, error: "Batida não encontrada." };
  const invalid = checkInput({ ...input, date: current.date });
  if (invalid) return { ok: false, error: invalid };
  const day = db.punchesOn(current.date);
  const after = day.map((p) => (p.id === id ? { ...p, ...input } : p));
  const error = checkSequence(day, after);
  if (error) return { ok: false, error };
  db.updatePunch(id, input);
  refresh();
  return { ok: true, message: "Batida atualizada." };
}

export async function removePunch(id: number): Promise<ActionResult> {
  db.deletePunch(id);
  refresh();
  return { ok: true, message: "Batida excluída." };
}

export async function setDayOverride(
  date: string,
  kind: OverrideKind | null,
): Promise<ActionResult> {
  if (!DATE_RE.test(date)) return { ok: false, error: "Data inválida." };
  if (kind && !(kind in OVERRIDE_LABELS)) return { ok: false, error: "Tipo inválido." };
  db.setOverride(date, kind);
  refresh();
  return {
    ok: true,
    message: kind ? `Dia marcado como ${OVERRIDE_LABELS[kind].toLowerCase()}.` : "Abono removido.",
  };
}

export async function updateSettings(input: {
  dailyHours: string;
  startDate: string;
}): Promise<ActionResult> {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(input.dailyHours);
  if (!match) return { ok: false, error: "Jornada deve estar no formato HH:MM." };
  const dailyMinutes = Number(match[1]) * 60 + Number(match[2]);
  if (dailyMinutes <= 0 || dailyMinutes > 24 * 60) {
    return { ok: false, error: "Jornada inválida." };
  }
  if (input.startDate && !DATE_RE.test(input.startDate)) {
    return { ok: false, error: "Data de início inválida." };
  }
  db.saveSettings({ dailyMinutes, startDate: input.startDate || null });
  refresh();
  return { ok: true, message: "Configurações salvas." };
}
