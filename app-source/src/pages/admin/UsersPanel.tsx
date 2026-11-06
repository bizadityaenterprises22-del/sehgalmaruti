import { useState } from "react";
import { adminCreateUser, adminSetActive, adminSetPassword, adminUpdateMember } from "@/app/api";
import { ROLE_LABEL } from "@/app/types";
import { useDesignations, useInvalidate, useLocations, useUsers } from "@/hooks/useQueries";
import { Badge, Button, Empty, Field, Input, Note, Section, Select, Table, Td, flash } from "@/components/ui";

/**
 * Logins by designation (the manpower sheet's list). A login ID + password is created for
 * a person, their designation decides the role, and the workshops they may see are
 * ticked. Ravi, 05-09-2026: "Then i will make further logins of GMs and AVPs and WMs,
 * CCMs etc etc." Everything here goes through the maruti-admin Edge Function - the
 * service key never reaches the phone.
 */
export default function UsersPanel() {
  const { data: users = [], isLoading, error } = useUsers(true);
  const { data: designations = [] } = useDesignations();
  const { data: locations = [] } = useLocations();
  const invalidate = useInvalidate();
  const [f, setF] = useState({
    login_code: "",
    display_name: "",
    password: "",
    designation_code: "",
    mobile: "",
    location_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const des = designations.find((d) => d.code === f.designation_code);
  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  async function create() {
    if (!f.login_code.trim() || !f.display_name.trim() || !f.designation_code)
      return flash("Login ID, name and designation are required.", "warn");
    if (f.password.length < 6) return flash("Password must be at least 6 characters.", "warn");
    setSaving(true);
    try {
      const r = await adminCreateUser({
        ...f,
        login_code: f.login_code.trim(),
        location_ids: f.location_ids.length ? f.location_ids : null,
      });
      flash(r.created ? `Login created: ${r.email}` : `Existing login ${r.email} added to Sehgal Maruti`);
      setF({ login_code: "", display_name: "", password: "", designation_code: "", mobile: "", location_ids: [] });
      invalidate("users");
    } catch (e) {
      flash((e as Error).message, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function setPassword(code: string) {
    const pw = window.prompt(`New password for ${code} (min 6 characters):`);
    if (!pw) return;
    try {
      await adminSetPassword(code, pw);
      flash(`Password set for ${code}`);
    } catch (e) {
      flash((e as Error).message, "danger");
    }
  }
  async function toggle(code: string, active: boolean) {
    try {
      await adminSetActive(code, active);
      flash(active ? `${code} activated` : `${code} deactivated`, active ? "ok" : "warn");
      invalidate("users");
    } catch (e) {
      flash((e as Error).message, "danger");
    }
  }
  async function changeDesignation(code: string, designation_code: string) {
    try {
      await adminUpdateMember({ login_code: code, designation_code });
      flash(`${code} updated`);
      invalidate("users");
    } catch (e) {
      flash((e as Error).message, "danger");
    }
  }

  return (
    <div className="space-y-4">
      <Section
        title="New login"
        sub="The login ID is what the person types (e.g. GM1, WM.BAVDHAN, an employee number). The designation decides the role."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Login ID">
            <Input
              value={f.login_code}
              onChange={(e) => setF({ ...f, login_code: e.target.value.toUpperCase() })}
              placeholder="GM1"
              autoCapitalize="characters"
            />
          </Field>
          <Field label="Full name">
            <Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} />
          </Field>
          <Field label="Password (min 6)">
            <Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
          </Field>
          <Field
            label="Designation (manpower sheet)"
            hint={
              des
                ? `Role: ${ROLE_LABEL[des.role]} · rank ${des.rank}${des.rank >= 70 ? " · can change drivers" : ""}${des.rank >= 90 ? " · admin pack" : ""}`
                : ""
            }
          >
            <Select value={f.designation_code} onChange={(e) => setF({ ...f, designation_code: e.target.value })}>
              <option value="">— choose —</option>
              {designations.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mobile">
            <Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} inputMode="tel" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-muted">Workshops (none ticked = all)</span>
            <div className="flex flex-wrap gap-2">
              {locations
                .filter((l) => l.is_active)
                .map((l) => (
                  <label
                    key={l.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-[12.5px] font-semibold ${f.location_ids.includes(l.id) ? "border-accent bg-accent/10 text-accent" : "border-line text-muted"}`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={f.location_ids.includes(l.id)}
                      onChange={(e) =>
                        setF({
                          ...f,
                          location_ids: e.target.checked ? [...f.location_ids, l.id] : f.location_ids.filter((x) => x !== l.id),
                        })
                      }
                    />
                    {l.name}
                  </label>
                ))}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button busy={saving} onClick={() => void create()}>
            Create login
          </Button>
        </div>
      </Section>

      <Section
        title={`Members of Sehgal Maruti · ${users.length}`}
        sub="Sehgal Maruti staff directory, roles, and workshop assignments."
      >
        {error ? (
          <Note tone="danger">{(error as Error).message}</Note>
        ) : isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : users.length === 0 ? (
          <Empty>No member yet.</Empty>
        ) : (
          <Table head={["Login", "Name", "Designation", "Role", "Workshops", "Status", "Actions"]}>
            {users.map((u) => (
              <tr key={u.profile_id} className="hover:bg-surface">
                <Td className="font-mono font-bold">{u.login_code ?? "—"}</Td>
                <Td>
                  {u.display_name}
                  <div className="text-[11px] text-muted">{u.contact_mobile ?? ""}</div>
                </Td>
                <Td>
                  <Select
                    value={designations.find((d) => d.name === u.designation)?.code ?? ""}
                    className="!py-1 !text-[12px]"
                    onChange={(e) => u.login_code && void changeDesignation(u.login_code, e.target.value)}
                  >
                    <option value="">{u.designation ?? "—"}</option>
                    {designations.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Badge tone={u.role === "admin" || u.role === "ceo" ? "brand" : "muted"}>{ROLE_LABEL[u.role] ?? u.role}</Badge>
                </Td>
                <Td className="text-[12px]">{u.location_ids?.length ? u.location_ids.map(locName).join(", ") : "All"}</Td>
                <Td>
                  <Badge tone={u.is_active ? "ok" : "danger"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                </Td>
                <Td className="space-x-1 whitespace-nowrap">
                  {u.login_code ? (
                    <Button size="sm" tone="secondary" onClick={() => void setPassword(u.login_code!)}>
                      Password
                    </Button>
                  ) : null}
                  {u.login_code && u.role !== "ceo" ? (
                    <Button size="sm" tone={u.is_active ? "danger" : "ok"} onClick={() => void toggle(u.login_code!, !u.is_active)}>
                      {u.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
