"use server";

import { format, isValid, isWeekend, parseISO } from "date-fns";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";
import { currentNow } from "@/lib/data";
import * as db from "@/lib/db";
import {
  DAY_NAMES,
  FORM_DAYS,
  formatDuration,
  jornadaFor,
  nextPunchType,
  OVERRIDE_LABELS,
  type OverrideKind,
  type PunchType,
  SINCE_START,
  toTime,
  validateSequence,
} from "@/lib/hours";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const UNAUTHORIZED: ActionResult = {
  ok: false,
  error: "Sessão expirada. Recarregue a página e entre de novo.",
};

const authorized = async () => isValidSession((await cookies()).get(SESSION_COOKIE)?.value);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const isType = (v: unknown): v is PunchType => v === "in" || v === "out";
const typeLabel = (t: PunchType) => (t === "in" ? "Entrada" : "Saída");

/** Bate o ponto agora; o tipo é o oposto da última batida do dia. */
export async function clockPunch(): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  const now = currentNow();
  const time = toTime(now.minutes);
  const today = await db.punchesOn(now.date);
  if (today.some((p) => p.time === time)) {
    return { ok: false, error: `Já existe uma batida às ${time}. Aguarde um minuto.` };
  }
  const type = nextPunchType(today);
  await db.insertPunch({ date: now.date, time, type, source: "clock" });
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
  if (!(await authorized())) return UNAUTHORIZED;
  const invalid = checkInput(input);
  if (invalid) return { ok: false, error: invalid };
  const day = await db.punchesOn(input.date);
  const error = checkSequence(day, [...day, input]);
  if (error) return { ok: false, error };
  await db.insertPunch({ ...input, source: "manual" });
  refresh();
  return { ok: true, message: `${typeLabel(input.type)} às ${input.time} adicionada.` };
}

export async function editPunch(
  id: number,
  input: Omit<PunchInput, "date">,
): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  const current = await db.getPunch(id);
  if (!current) return { ok: false, error: "Batida não encontrada." };
  const invalid = checkInput({ ...input, date: current.date });
  if (invalid) return { ok: false, error: invalid };
  const day = await db.punchesOn(current.date);
  const after = day.map((p) => (p.id === id ? { ...p, ...input } : p));
  const error = checkSequence(day, after);
  if (error) return { ok: false, error };
  await db.updatePunch(id, input);
  refresh();
  return { ok: true, message: "Batida atualizada." };
}

export async function removePunch(id: number): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  await db.deletePunch(id);
  refresh();
  return { ok: true, message: "Batida excluída." };
}

/**
 * Marca o abono do dia. Com `hours` (HH:MM) o abono é parcial e só reduz a meta;
 * vazio abona o dia inteiro.
 */
export async function setDayOverride(
  date: string,
  kind: OverrideKind | null,
  hours = "",
): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  if (!DATE_RE.test(date)) return { ok: false, error: "Data inválida." };
  if (kind && !(kind in OVERRIDE_LABELS)) return { ok: false, error: "Tipo inválido." };

  let minutes: number | null = null;
  if (kind && hours) {
    const match = /^(\d{2}):([0-5]\d)$/.exec(hours);
    minutes = match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    if (!minutes) return { ok: false, error: "Horas abonadas devem estar no formato HH:MM." };
    const dayMinutes = jornadaFor(date, await db.listSchedules());
    if (dayMinutes === 0) {
      return {
        ok: false,
        error: isWeekend(parseISO(date))
          ? "Fim de semana já tem meta de 0h."
          : "Este dia não tem jornada, a meta já é 0h.",
      };
    }
    if (minutes >= dayMinutes) {
      return {
        ok: false,
        error: `Abono parcial deve ser menor que a jornada de ${formatDuration(dayMinutes)}. Para o dia todo, deixe as horas em branco.`,
      };
    }
  }

  await db.setOverride(date, kind, null, minutes);
  refresh();
  if (!kind) return { ok: true, message: "Abono removido." };
  if (minutes) {
    const done = kind === "folga" ? "registrada" : "registrado";
    return {
      ok: true,
      message: `${OVERRIDE_LABELS[kind]} de ${formatDuration(minutes)} ${done}.`,
    };
  }
  return { ok: true, message: `Dia marcado como ${OVERRIDE_LABELS[kind].toLowerCase()}.` };
}

export async function updateSettings(input: { startDate: string }): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  if (input.startDate && !DATE_RE.test(input.startDate)) {
    return { ok: false, error: "Data de início inválida." };
  }
  await db.saveSettings({ startDate: input.startDate || null });
  refresh();
  return { ok: true, message: "Configurações salvas." };
}

const dateLabel = (date: string) => format(parseISO(date), "dd/MM/yyyy");

/**
 * Salva a jornada de cada dia (`hours[0]` = domingo, HH:MM) a partir de `validFrom`.
 * Data vazia substitui a jornada "desde o início"; a mesma data substitui a anterior.
 */
export async function saveSchedule(input: {
  validFrom: string;
  hours: string[];
}): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  const validFrom = input.validFrom || SINCE_START;
  if (!DATE_RE.test(validFrom) || !isValid(parseISO(validFrom))) {
    return { ok: false, error: "Data inválida." };
  }
  const minutes: number[] = [];
  for (const day of FORM_DAYS) {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(input.hours[day] ?? "");
    const value = match ? Number(match[1]) * 60 + Number(match[2]) : -1;
    if (value < 0 || value > 24 * 60) {
      return {
        ok: false,
        error: `Jornada de ${DAY_NAMES[day]} deve estar no formato HH:MM, até 24:00.`,
      };
    }
    minutes[day] = value;
  }
  if (minutes.every((m) => m === 0)) {
    return { ok: false, error: "Informe a jornada de pelo menos um dia." };
  }
  await db.saveSchedule({ validFrom, minutes });
  refresh();
  return {
    ok: true,
    message:
      validFrom === SINCE_START
        ? "Jornada desde o início salva."
        : `Jornada salva a partir de ${dateLabel(validFrom)}.`,
  };
}

export async function removeSchedule(validFrom: string): Promise<ActionResult> {
  if (!(await authorized())) return UNAUTHORIZED;
  if (validFrom === SINCE_START) {
    return { ok: false, error: "A jornada desde o início não pode ser removida." };
  }
  if (!DATE_RE.test(validFrom)) return { ok: false, error: "Data inválida." };
  await db.deleteSchedule(validFrom);
  refresh();
  return { ok: true, message: `Jornada de ${dateLabel(validFrom)} removida.` };
}
